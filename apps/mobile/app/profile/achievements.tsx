import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen, ScreenHeader, Text, Button } from "@/components/ui";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACHIEVEMENTS,
  EMPTY_ACHIEVEMENTS_STATE,
  MAX_FEATURED_ACHIEVEMENTS,
  evaluateAndUnlockAchievements,
  fetchAchievementsState,
  fetchFeaturedAchievementIds,
  updateFeaturedAchievementIds,
  isNewAndUncelebrated,
  progressFor,
  type AchievementId,
  type AchievementsState,
} from "@/lib/achievements";

/**
 * CACHE LOCAL (2026-10-16, causa raiz do "cinza, depois carrega de
 * repente" relatado por vídeo) — antes, esta tela sempre começava com
 * `EMPTY_ACHIEVEMENTS_STATE` (tudo bloqueado/0) enquanto
 * `evaluateAndUnlockAchievements`+`fetchAchievementsState` resolviam
 * (~1s), só então trocando pro estado real — isso era intencional (ver
 * comentário grande abaixo, "Enquanto a busca real não volta..."), mas
 * o usuário reportou o mesmo comportamento como bug incômodo de novo.
 * Opção escolhida (dentre 3 apresentadas): cache local
 * stale-while-revalidate, mesmo padrão já usado em `useCurrentUser.ts`
 * — guarda o último `AchievementsState` visto em `AsyncStorage` e
 * renderiza ele IMEDIATAMENTE ao abrir a tela, sem esperar a rede;
 * busca o estado real por trás, em silêncio, e só troca a UI se algo
 * realmente mudou (novo desbloqueio/progresso). Na prática, a maioria
 * das aberturas (nada novo desde a última vez) deixa de ter qualquer
 * flash — só a PRIMEIRA abertura de cada aparelho (sem cache ainda)
 * continua mostrando o "tudo bloqueado" inicial, inevitável sem dado
 * nenhum salvo ainda.
 *
 * Versão no nome da chave (mesma convenção de
 * `CURRENT_USER_CACHE_VERSION`): se o formato de `AchievementsState`
 * mudar de novo no futuro (já aconteceu uma vez, 2026-10-17, quando
 * `progressCounts` ganhou 4 campos novos — e de novo agora, quando
 * `celebratedAt` foi adicionado pro selo "Novo"), bump aqui força um
 * refetch por aparelho em vez de um cache antigo incompleto quebrar a
 * leitura — por isso o merge defensivo logo abaixo
 * (`mergeWithDefaults`) também protege contra um cache de uma versão
 * anterior que não tenha sido invalidado a tempo.
 */
const ACHIEVEMENTS_CACHE_VERSION = 2;

function achievementsCacheKeyFor(userId: string): string {
  return `seenlist:achievements:state:v${ACHIEVEMENTS_CACHE_VERSION}:${userId}`;
}

/**
 * Funde o estado salvo em cache com os defaults atuais — protege
 * contra um cache salvo ANTES de um emblema novo ter sido adicionado
 * (`unlocked`/`unlockedAt` sem a chave nova) ou antes de um campo novo
 * ter sido adicionado a `progressCounts`, sem precisar descartar o
 * cache inteiro (que traria de volta o flash que esta mudança resolve).
 */
function mergeWithDefaults(cached: AchievementsState): AchievementsState {
  return {
    ...EMPTY_ACHIEVEMENTS_STATE,
    ...cached,
    unlocked: { ...EMPTY_ACHIEVEMENTS_STATE.unlocked, ...cached.unlocked },
    unlockedAt: { ...EMPTY_ACHIEVEMENTS_STATE.unlockedAt, ...cached.unlockedAt },
    celebratedAt: { ...EMPTY_ACHIEVEMENTS_STATE.celebratedAt, ...cached.celebratedAt },
    progressCounts: { ...EMPTY_ACHIEVEMENTS_STATE.progressCounts, ...cached.progressCounts },
  };
}

/**
 * PILOTO — tela de Conquistas (2026-10-15, 3º ajuste no mesmo dia, a
 * pedido explícito, referência enviada — mockup do GPT aprovado "sem
 * as manchas"). Grade de 3 colunas (fórmula igual à de
 * `PosterGrid.tsx` — `Math.floor()` evita que a soma "3 cards + 2
 * espaços" estoure por uma margem mínima em certos aparelhos), nome
 * centralizado embaixo do emblema (até 2 linhas), progresso tipo
 * "4 de 10" embaixo do nome quando bloqueado. SEM fundo com
 * gradiente/manchas (liso, igual ao Feed — pedido explícito, mesmo a
 * referência enviada mostrando um gradiente: "ele sugere deixar o
 * gradiente, mas tire").
 *
 * NOTA — isso deixa esta tela inconsistente de propósito com as
 * outras subpáginas do Perfil (stats/movies/series/etc.), que usam
 * `GlassTargetProvider`+`AmbientGlow` igual em todas (ver histórico em
 * `movies.tsx`) — removido aqui por pedido explícito, não esquecimento.
 *
 * O TOQUE NO EMBLEMA AGORA NAVEGA PRA UMA TELA DEDICADA
 * (`/profile/achievements/[id]`), não mais um modal/bottom-sheet —
 * pedido explícito (ver mockup: tela cheia própria, com seta de
 * voltar, sem a barra de navegação embaixo — essa parte é escondida
 * em `app/_layout.tsx`, mesmo mecanismo já usado por `week-review` e
 * `season-recap`).
 *
 * Só os 4 emblemas já aprovados (ver `lib/achievements.ts`). Colorido
 * quando conquistado / cinza quando bloqueado — a PNG já traz o
 * número do requisito desenhado, por isso NENHUM número é renderizado
 * por cima da IMAGEM aqui (a pedido explícito) — só o texto de
 * progresso abaixo do nome.
 *
 * SEM ANIMAÇÃO ainda (a pedido) — isso entra só depois, no Maratonista,
 * com Reanimated.
 *
 * REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
 * primeiros") — antes, progresso e desbloqueio vinham de
 * `DEMO_UNLOCKED`/`DEMO_PROGRESS` (sem banco nenhum). Agora: ao abrir
 * esta tela, chama `evaluateAndUnlockAchievements` (função no
 * Postgres que confere os 4 critérios de verdade e grava o que for
 * novo em `user_achievements`) e, em seguida, `fetchAchievementsState`
 * (lê o estado real já atualizado). Decisão do usuário: a checagem só
 * roda AQUI, ao abrir a tela — não a cada episódio/filme marcado —
 * mais barato, um único ponto no código (um desbloqueio recente só
 * aparece a partir da próxima vez que a tela for aberta, não na hora).
 * Enquanto a busca real não volta, a grade originalmente começava com
 * tudo bloqueado/0 (sem skeleton dedicado — "pisca rápido e assenta"
 * tido como aceitável na época, tela secundária). Isso voltou como
 * reclamação de bug depois (vídeo mostrando exatamente esse "cinza,
 * depois carrega de repente") — ver o cache local logo acima
 * (`ACHIEVEMENTS_CACHE_VERSION`/`mergeWithDefaults`), que resolve isso
 * pra toda abertura exceto a primeira do aparelho (sem cache ainda).
 *
 * CAUSA RAIZ DO ESPAÇO VERTICAL ENTRE LINHAS (histórico, 2026-10-15) —
 * o `columnWrapperStyle` de cada linha do `FlatList` não definia
 * `alignItems`, caindo no padrão do Yoga (`"stretch"`), que esticava
 * os 3 cards de uma linha pra altura do irmão mais alto (o bloqueado,
 * com a linha extra de progresso). Corrigido com `alignItems:
 * "flex-start"` na linha + progresso sempre renderizado (oculto via
 * `opacity: 0` quando desbloqueado), pra reservar a MESMA altura em
 * todo card sem depender do stretch.
 *
 * 4º AJUSTE (2026-10-15, "pequenos refinamentos", visual já aprovado)
 * — 3 pedidos específicos:
 * 1. Distância nome→progresso pra ~4-6px.
 * 2. Alinhamento consistente entre cards, reservando espaço pra nome
 *    de até 2 linhas E progresso.
 * 3. Aproximar discretamente a 2ª linha da 1ª, sem reduzir o emblema.
 *
 * Os pedidos 1 e 2 pareciam conflitar com a versão anterior: lá, o
 * nome tinha uma caixa de ALTURA FIXA pra 2 linhas (`height: 28`) pra
 * garantir alinhamento — mas um nome de 1 linha só ("Clássicos",
 * "Madrugada") ainda assim ocupava essa caixa toda, sobrando um vão
 * vazio embaixo do texto ANTES do `marginTop` do progresso entrar —
 * ou seja, o espaço visual entre nome e progresso, pra nomes de 1
 * linha, era "vão vazio da caixa" + `marginTop`, não só o `marginTop`
 * (por isso 4-6px de marginTop não bastava, o vão de verdade era bem
 * maior). CORREÇÃO: a altura fixa saiu do `tileName` sozinho e virou
 * `minHeight` do BLOCO (`textBlock`, nome+progresso juntos) — agora o
 * nome ocupa só a altura do próprio texto (1 ou 2 linhas), o progresso
 * fica logo colado nele (`marginTop: 5`, dentro da faixa pedida), e o
 * `minHeight` do bloco garante que todo card da grade ocupe a MESMA
 * altura total (reservando a pior hipótese: 2 linhas de nome +
 * progresso) — o alinhamento entre linhas continua garantido, só que
 * agora o vão "sobra" DEPOIS do progresso (dentro do próprio card,
 * antes do próximo), em vez de ENTRE nome e progresso.
 *
 * Pedido 3 (`GRID_GAP_VERTICAL`): reduzido de `spacing.lg` (24) pra um
 * valor um pouco menor (18) — moderado e discreto, como pedido, sem
 * tocar no `IMAGE_SCALE`/`cardWidth`. IMPORTANTE, transparência com o
 * usuário: uma parte do espaço visual entre a 1ª e a 2ª linha, hoje,
 * não é CSS/layout — é a própria margem transparente interna dos PNGs
 * aprovados (confirmada antes, por análise de pixel: ~17-19% de
 * margem vazia em cada lado do quadro 512×512 do medalhão). Como os
 * PNGs estão proibidos de mudar, esse pedaço do espaço tem um "piso"
 * que o `GRID_GAP_VERTICAL` sozinho não consegue zerar — se depois da
 * captura ainda parecer grande, a causa é essa margem interna, não
 * falta de ajuste aqui.
 */
const GRID_COLUMNS = 3;
const GRID_GAP_HORIZONTAL = spacing.sm;
const GRID_GAP_VERTICAL = 18;
/**
 * +20% no tamanho visual do emblema (a pedido, 2026-10-15) — SEM
 * aumentar a célula do grid (`cardWidth` continua a mesma, 3 colunas
 * intactas). Matematicamente, com 3 colunas numa tela de ~375pt, não
 * cabe aumentar a CÉLULA em 20% (o máximo teórico, com padding/gap
 * zerados, já seria só uns ~15%) — por isso a imagem é renderizada
 * MAIOR que sua própria célula (`cardWidth * IMAGE_SCALE`), transbordando
 * um pouco por cima do espaço vazio entre colunas (`overflow` visível,
 * sem cortar nada). Isso não gruda um emblema no outro porque os PNGs
 * já têm uma margem transparente generosa ao redor do medalhão (~17%
 * de cada lado, confirmado na checagem técnica dos assets) — é essa
 * margem que absorve o transbordamento. A área de toque de cada
 * emblema continua sendo exatamente `cardWidth` (o React Native usa o
 * quadro do próprio `Pressable`, não o da imagem, pra decidir onde um
 * toque pertence) — sem ambiguidade entre emblemas vizinhos.
 */
const IMAGE_SCALE = 1.2;

/**
 * RECORTE PRECISO DO HEXÁGONO, SEM LIB NOVA (2026-10-16, a pedido —
 * ver comentário grande junto de `sweepAnim`, mais abaixo, pra todo o
 * histórico da investigação). Estas frações (0 a 1, relativas a
 * `imageSize`) vêm de medir o canal alfa dos 28 PNGs `*-color.png`
 * reais em `assets/badges/achievements/` (script Python/PIL, nesta
 * mesma conversa).
 *
 * CAUSA RAIZ DO "EMBLEMAS CORROÍDOS" (2026-10-16, a pedido — vídeo
 * mostrando bordas serrilhadas/comidas em emblemas como Centenário,
 * Cinetrão, Finalista e Em-dia, DEPOIS da correção de ordem que pôs o
 * brilho por cima da imagem) — a primeira versão desta tabela usava a
 * direção ERRADA: pra cada faixa, pegava o pixel opaco mais à direita
 * entre os 28 arquivos pro lado esquerdo (e mais à esquerda pro lado
 * direito) — ou seja, a INTERSEÇÃO mais apertada (o emblema mais
 * "estreito" da amostra definia o limite pra TODOS). Isso era seguro
 * SÓ enquanto a `Image` ficava por cima de tudo (cobertura agressiva
 * demais não importava, a imagem repintava por cima e escondia o
 * excesso) — mas depois da correção de hoje (brilho por cima da
 * imagem), uma cobertura calculada pelo emblema mais estreito passou a
 * pintar por cima da arte de verdade dos emblemas mais LARGOS (como o
 * troféu do Centenário ou a câmera do Cinetrão, cujo hexágono real
 * ocupa mais espaço que a média da amostra) — daí o "corroído": a
 * cobertura comia a borda real desses emblemas específicos.
 *
 * CORREÇÃO: direção invertida — cada faixa agora usa o pixel opaco
 * mais à ESQUERDA entre os 28 arquivos pro limite esquerdo (e mais à
 * DIREITA pro limite direito) — a UNIÃO mais generosa, pelo emblema
 * mais LARGO da amostra. Assim a cobertura NUNCA avança sobre a arte
 * real de nenhum emblema, por mais larga que a silhueta dele seja —
 * ao custo de, em troca, deixar uma margem mínima e imperceptível do
 * brilho vazando pros emblemas mais estreitos (câmbio aceitável: um
 * pixel ou dois de vazamento no sweep é inofensivo; comer borda de
 * arte de verdade não é).
 */
const SWEEP_HEX_BANDS = [
  { top: 0.075, bottom: 0.1, left: 0.4121, right: 0.584 },
  { top: 0.1, bottom: 0.125, left: 0.3711, right: 0.623 },
  { top: 0.125, bottom: 0.15, left: 0.3281, right: 0.668 },
  { top: 0.15, bottom: 0.175, left: 0.2832, right: 0.7109 },
  { top: 0.175, bottom: 0.2, left: 0.2402, right: 0.7559 },
  { top: 0.2, bottom: 0.225, left: 0.1973, right: 0.7988 },
  // 0.225–0.675: largura máxima do hexágono (lados retos, pro emblema
  // mais largo da amostra) — já bate na própria caixa delimitadora
  // (`SWEEP_HEX_BOUNDS`), sem sobra pra cobertura nenhuma.
  { top: 0.675, bottom: 0.7, left: 0.2246, right: 0.7734 },
  { top: 0.7, bottom: 0.725, left: 0.2695, right: 0.7285 },
  { top: 0.725, bottom: 0.75, left: 0.3145, right: 0.6816 },
  { top: 0.75, bottom: 0.775, left: 0.3301, right: 0.6543 },
  { top: 0.775, bottom: 0.8, left: 0.332, right: 0.6543 },
  { top: 0.8, bottom: 0.825, left: 0.3301, right: 0.6543 },
  { top: 0.825, bottom: 0.85, left: 0.3301, right: 0.6543 },
  { top: 0.85, bottom: 0.875, left: 0.3301, right: 0.6543 },
  { top: 0.875, bottom: 0.9, left: 0.3301, right: 0.6543 },
  { top: 0.9, bottom: 0.925, left: 0.3301, right: 0.6543 },
] as const;

/**
 * Caixa delimitadora (o retângulo que o `newSweepClip` recorta de
 * verdade, via `overflow: "hidden"`) — insets SIMÉTRICOS (uso o maior
 * entre esquerda/direita e entre cima/baixo medidos, pra nunca cortar
 * o hexágono de nenhum emblema mesmo com a pequena assimetria natural
 * da amostragem de pixel). Tudo que esta caixa ainda deixa passar (os
 * 4 cantos/afunilamentos) é coberto pelos retângulos de
 * `SWEEP_HEX_BANDS` acima, na cor de fundo da tela.
 */
const SWEEP_HEX_BOUNDS = { insetX: 0.1816, insetY: 0.075 };

/**
 * NOVO (2026-10-17, card "Conquistas" de volta pro Perfil — mockup
 * aprovado, 3 cenários) — modo de seleção pra escolher até
 * `MAX_FEATURED_ACHIEVEMENTS` emblemas JÁ DESBLOQUEADOS que aparecem
 * no card resumido do Perfil (`AchievementsCard.tsx`). Decisão do
 * usuário (pergunta explícita): a ação mora NESTA tela ("Ver todas"),
 * não num toque longo no próprio card nem numa tela separada.
 *
 * Fluxo: botão no cabeçalho entra no modo; toque num emblema
 * DESBLOQUEADO alterna a seleção (até o limite); um emblema BLOQUEADO
 * nunca é selecionável (regra explícita do pedido — "apenas emblemas
 * que já foram desbloqueado"), fica só visualmente apagado nesse modo
 * pra reforçar isso. "Cancelar" (no lugar do back padrão) descarta;
 * "Salvar" grava via `updateFeaturedAchievementIds` e sai do modo. Uma
 * lista vazia salva como `[]` é tratada como "nunca escolheu" na
 * leitura (`fetchFeaturedAchievementIds`) — ou seja, desmarcar tudo e
 * salvar volta o card pro padrão automático (últimos desbloqueados).
 *
 * CAUSA RAIZ — ANIMAÇÃO DE DESBLOQUEIO NUNCA TOCAVA, PRA NENHUM
 * EMBLEMA (2026-10-16, bug reportado por vídeo: "nenhuma das
 * conquistas fez a animação de desbloqueio") — havia uma correção
 * anterior aqui (repassar `?justUnlocked=1` na rota, pra contornar o
 * fato de que só a PRIMEIRA chamada de `evaluate_and_unlock_achievements`
 * que grava um desbloqueio devolve o id, e a grade sempre chama antes
 * da tela de detalhe). Isso resolvia o caso de um desbloqueio
 * acontecendo NA HORA, mas não o caso real reportado: TODOS os
 * emblemas do usuário já tinham sido desbloqueados ANTES dessa
 * celebração existir — pra eles, a função nunca mais devolve o id,
 * em NENHUMA chamada futura, de nenhuma tela. Ou seja, o sinal "a
 * função acabou de gravar isso" não é a mesma coisa que "o usuário
 * ainda não viu a celebração disso" — o primeiro é um evento
 * passageiro de uma chamada; o segundo precisa ser um FATO
 * persistente.
 *
 * CORREÇÃO DE RAIZ (substitui o mecanismo de `justUnlockedIds`/
 * `?justUnlocked=1` por completo — ver migration
 * `20261017000009_user_achievements_celebrated_at.sql`): o banco agora
 * guarda, por usuário e por emblema, se a celebração já foi vista
 * (`user_achievements.celebrated_at`). `isNewAndUncelebrated(id, state)`
 * (em `lib/achievements.ts`) é a fonte única de verdade de "isso é
 * novo?", usada tanto aqui (selo "Novo" na grade) quanto na tela de
 * detalhe (dispara a celebração) — as duas nunca podem divergir,
 * porque leem o MESMO campo do MESMO `AchievementsState`. Navegar pra
 * um emblema não precisa mais passar nenhum parâmetro de rota — a
 * tela de detalhe busca o estado de novo (como sempre fez) e decide
 * sozinha.
 */
export default function AchievementsScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<AchievementsState>(EMPTY_ACHIEVEMENTS_STATE);
  const [featuredIds, setFeaturedIds] = useState<AchievementId[] | null>(null);
  /**
   * CORREÇÃO (bug real, reportado — "emblema com requisito certo não
   * aparecia desbloqueado") — CAUSA RAIZ ENCONTRADA: `evaluateAndUnlockAchievements`
   * e as duas buscas que vinham depois (`fetchAchievementsState`/
   * `fetchFeaturedAchievementIds`) não tinham NENHUM tratamento de
   * erro — rodei a mesma função direto no banco pra conta do tester
   * afetado e ela gravou corretamente todos os emblemas que já batiam
   * o critério, provando que a lógica do banco sempre esteve certa.
   * Qualquer soluço de rede durante essas três chamadas (bem comum na
   * PRIMEIRA abertura da tela, sem cache ainda) estourava uma exceção
   * não tratada, `setState(fresh)` nunca rodava, e a tela ficava
   * parada no `EMPTY_ACHIEVEMENTS_STATE` inicial — tudo bloqueado —
   * sem aviso de erro e sem jeito de tentar de novo, mesmo com os
   * emblemas já concedidos de verdade no banco. `syncError` guarda se
   * a sincronização falhou DEPOIS de esgotar as retentativas
   * automáticas (ver `runSync` no efeito abaixo) — usado só pra
   * mostrar o aviso não-bloqueante (`styles.syncErrorBanner`) com
   * "Tentar de novo"; a grade continua mostrando o último estado
   * conhecido (cache ou já sincronizado), nunca é substituída por uma
   * tela cheia de erro — mesmo espírito "stale-while-revalidate" já
   * documentado no topo deste arquivo.
   */
  const [syncError, setSyncError] = useState(false);
  const retrySyncRef = useRef<() => void>(() => {});
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<AchievementId[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const reducedMotion = useReducedMotion();
  /**
   * BRILHO VARRENDO (2026-10-16, a pedido — vídeo mostrando os halos
   * amarelos de "novo" esbarrando uns nos outros + mockup de 10
   * opções, escolhida a opção 6) — SUBSTITUI o halo pulsante antigo
   * (`newGlow`, removido — era um círculo `inset: -8` atrás do
   * emblema, que ESTOURAVA a própria célula: a imagem já é 20% maior
   * que a célula de propósito — `IMAGE_SCALE`, ver comentário mais
   * abaixo — então o halo de mais 8px em cada lado passava a tocar o
   * emblema vizinho quando vários tiles são "novos" ao mesmo tempo,
   * como no seu teste). Em vez de um círculo que cresce pra FORA, um
   * reflexo de luz que varre por DENTRO — a área do brilho nunca passa
   * do tamanho exato da imagem do emblema (`imageSize x imageSize`,
   * com `overflow: "hidden"`, ver `newSweepClip`/`newSweepStrip`
   * abaixo), então fisicamente não tem como encostar no vizinho, não
   * importa quantos emblemas estejam marcados como novos.
   *
   * ATUALIZAÇÃO (2026-10-16, a pedido — "preciso que o recorte seja
   * preciso", DEPOIS de decidir explicitamente NÃO adicionar nenhuma
   * dependência nova — "quero algo que resolva e dê pra mandar por
   * EAS") — uma tentativa anterior usou `@react-native-masked-view/
   * masked-view` (máscara real, pixel a pixel), mas é lib NATIVA: exige
   * build novo (`eas build`), não dá pra mandar só por `eas update`.
   * Revertida. A solução final (ver `SWEEP_HEX_BANDS` no topo do
   * arquivo + `sweepCoverRects` abaixo) não usa nenhuma lib nova — é
   * só `View` com `overflow: "hidden"` e retângulos de cobertura na
   * cor de fundo, com as medidas tiradas direto do canal alfa dos 28
   * PNGs reais (`*-color.png`, script Python/PIL, ver histórico desta
   * conversa) — ou seja, "preciso" no sentido literal: as coordenadas
   * vêm do pixel real do arquivo, não de uma estimativa.
   *
   * CAUSA RAIZ DO VAZAMENTO (2026-10-16, a pedido — vídeo mostrando o
   * brilho em "forma de quadrado" bem maior que o emblema) — o
   * `overflow: "hidden"` sempre esteve certo no código, mas não
   * estava sendo aplicado de verdade a nível nativo. Duas tentativas,
   * nesta ordem:
   * A) `collapsable={false}` na view de recorte (`newSweepClip`) —
   *    impede o RN de "achatar"/otimizar essa view (quando isso
   *    acontece, o recorte nunca chega a existir nativamente). Não
   *    resolveu sozinho ("continue a mesma coisa").
   * B) (ESTA, aplicada) `useNativeDriver: false` no `sweepAnim` — a
   *    causa real: o driver nativo aplica a rotação/translação do
   *    `Animated.View` direto numa camada nativa, por FORA do ciclo
   *    normal de medir/recortar do RN, então o `overflow: "hidden"`
   *    do pai nunca via essa transformação pra recortar contra ela.
   *    Com `useNativeDriver: false`, o cálculo volta a passar pelo
   *    JS a cada frame, dentro do caminho normal que respeita
   *    `overflow: "hidden"`. Custo de performance desprezível (UM
   *    `Animated.Value` pra grade inteira, não um por emblema).
   *
   * UM `Animated.Value` compartilhado por todos os tiles "novos" da
   * grade (mesmo espírito de antes) — roda sempre em loop (custo
   * desprezível mesmo sem nenhum tile novo); pulado por completo
   * quando o sistema pede redução de movimento.
   */
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    // OPÇÃO B (2026-10-16, a pedido — opção A sozinha,
    // `collapsable={false}`, não resolveu: "continue a mesma coisa,
    // como se existisse na imagem do emblema um quadrado invisível")
    // — `useNativeDriver: false` tira este transform do caminho do
    // driver nativo (que aplica a transformação direto numa camada
    // nativa, por fora do ciclo normal de medir/recortar do RN) e
    // volta pro cálculo via JS a cada frame, que respeita
    // `overflow: "hidden"` do jeito esperado. Impacto de performance
    // desprezível aqui — é UM `Animated.Value` compartilhado pela
    // grade inteira, não um por emblema.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.delay(1300),
        Animated.timing(sweepAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, sweepAnim]);

  useEffect(() => {
    if (!userId) return;
    // Capturado aqui fora — dentro de `load()` (função aninhada,
    // assíncrona) o TypeScript não carrega a checagem acima, mesmo
    // sendo o mesmo valor (limitação conhecida do controle de fluxo
    // do TS através de closures assíncronas, achado real ao rodar
    // `tsc --noEmit` — mesmo idioma já usado em `useCurrentUser.ts`).
    const currentUserId = userId;
    let cancelled = false;
    const cacheKey = achievementsCacheKeyFor(currentUserId);

    async function loadCache() {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (!cancelled && raw) {
          setState(mergeWithDefaults(JSON.parse(raw) as AchievementsState));
        }
      } catch (error) {
        console.warn("[achievements] Cache local corrompido — ignorando", error);
      }
    }

    /**
     * Avalia + busca o estado real. 1 tentativa inicial + até 2
     * retentativas automáticas (backoff simples: 800ms, depois
     * 1600ms) — cobre o caso mais comum, um soluço passageiro de
     * rede. Se as 3 tentativas falharem, `syncError` vira `true` (o
     * aviso não-bloqueante aparece) e o último estado conhecido
     * (cache ou estado anterior) continua na tela — nunca em branco,
     * nunca travado sem explicação.
     *
     * O valor de retorno de `evaluateAndUnlockAchievements` (ids
     * desbloqueados NESTA chamada) não é usado aqui — ver comentário
     * grande no topo do arquivo ("CAUSA RAIZ — ANIMAÇÃO DE DESBLOQUEIO
     * NUNCA TOCAVA"). A chamada ainda precisa acontecer (é ela que de
     * fato confere os critérios e grava o desbloqueio no banco), só o
     * retorno virou irrelevante.
     */
    async function runSync() {
      const MAX_ATTEMPTS = 3;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          await evaluateAndUnlockAchievements(currentUserId);
          const [fresh, featured] = await Promise.all([
            fetchAchievementsState(currentUserId),
            fetchFeaturedAchievementIds(currentUserId),
          ]);
          if (cancelled) return;
          setState(fresh);
          setFeaturedIds(featured);
          setSyncError(false);
          AsyncStorage.setItem(cacheKey, JSON.stringify(fresh)).catch((error) => {
            console.warn("[achievements] Falha ao salvar cache local", error);
          });
          return;
        } catch (error) {
          lastError = error;
          if (attempt < MAX_ATTEMPTS && !cancelled) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
          }
        }
      }

      if (!cancelled) {
        console.warn("[achievements] Falha ao sincronizar conquistas após 3 tentativas", lastError);
        setSyncError(true);
      }
    }

    retrySyncRef.current = () => {
      setSyncError(false);
      runSync();
    };

    loadCache().then(() => {
      if (!cancelled) runSync();
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const cardWidth = Math.floor((width - spacing.md * 2 - GRID_GAP_HORIZONTAL * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const imageSize = Math.round(cardWidth * IMAGE_SCALE);
  // Faixa em PX (não fração) — precisa de `imageSize`, só conhecido
  // aqui (depende da largura da janela). `useMemo` com `imageSize` na
  // lista de dependências (mesmo motivo do `useMemo` acima: evitar
  // recriar o objeto de interpolação em todo render com
  // `useNativeDriver`) — na prática quase nunca recalcula, já que
  // `imageSize` só muda se a janela girar/redimensionar.
  const sweepStripWidth = Math.round(imageSize * 0.55);
  const sweepTranslate = useMemo(
    () => sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-sweepStripWidth * 1.3, imageSize + sweepStripWidth * 1.3] }),
    [sweepAnim, imageSize, sweepStripWidth]
  );
  // Caixa delimitadora do recorte (retângulo real que o `overflow:
  // "hidden"` aplica) — ver `SWEEP_HEX_BOUNDS` no topo do arquivo pra
  // origem das medidas.
  const sweepClipInsetX = Math.round(imageSize * SWEEP_HEX_BOUNDS.insetX);
  const sweepClipInsetY = Math.round(imageSize * SWEEP_HEX_BOUNDS.insetY);
  // RECORTE PRECISO NO HEXÁGONO, SEM LIB NOVA (2026-10-16, a pedido —
  // "você reduziu o quadrado mas não está em formato de hexágono...
  // preciso que o recorte seja preciso", e depois "não quero uma
  // dependência nova, quero algo que resolva e dê pra mandar por EAS")
  // — além da caixa delimitadora acima (que já é bem mais apertada que
  // a tentativa anterior), os 4 cantos/afunilamentos que ainda sobram
  // dentro dela são tapados por retângulos sólidos na cor de fundo da
  // tela (`colors.background` — a MESMA cor que já aparece atrás do
  // emblema hoje, através da margem transparente do PNG, então pintar
  // de novo por cima não muda nada visualmente onde já não há arte
  // real). `SWEEP_HEX_BANDS` traz as frações medidas; aqui só
  // converto pra pixels, uma vez por mudança de `imageSize`.
  const sweepCoverRects = useMemo(
    () =>
      SWEEP_HEX_BANDS.map((band) => {
        const top = Math.round(band.top * imageSize);
        const bottom = Math.round(band.bottom * imageSize);
        const left = Math.round(band.left * imageSize);
        const right = Math.round(band.right * imageSize);
        return {
          top,
          height: Math.max(1, bottom - top),
          // Cobertura ESQUERDA: da borda da caixa delimitadora até o início real do hexágono nesta faixa.
          leftCoverLeft: sweepClipInsetX,
          leftCoverWidth: Math.max(0, left - sweepClipInsetX),
          // Cobertura DIREITA: do fim real do hexágono nesta faixa até a borda da caixa delimitadora.
          rightCoverLeft: right,
          rightCoverWidth: Math.max(0, imageSize - sweepClipInsetX - right),
        };
      }),
    [imageSize, sweepClipInsetX]
  );

  function enterSelectionMode() {
    // Pré-preenche com o que já está em destaque hoje (escolha manual
    // existente, ou — se nunca escolheu — nada marcado; o padrão
    // automático continua valendo até a pessoa salvar uma escolha
    // própria, não precisa aparecer pré-marcado aqui).
    setSelectedIds(featuredIds ?? []);
    setSelectionMode(true);
  }

  function cancelSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function toggleSelected(id: AchievementId) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((existing) => existing !== id);
      if (current.length >= MAX_FEATURED_ACHIEVEMENTS) return current;
      return [...current, id];
    });
  }

  async function saveSelection() {
    if (!userId || isSaving) return;
    setIsSaving(true);
    const ok = await updateFeaturedAchievementIds(userId, selectedIds);
    setIsSaving(false);
    if (ok) {
      setFeaturedIds(selectedIds.length > 0 ? selectedIds : null);
      setSelectionMode(false);
      setSelectedIds([]);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={t("achievements.screenTitle")}
        onBack={selectionMode ? cancelSelectionMode : undefined}
        right={
          selectionMode ? (
            <Pressable
              onPress={saveSelection}
              disabled={isSaving}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("achievements.chooseFeaturedSave")}
            >
              <Text style={[styles.headerAction, isSaving && styles.headerActionDisabled]}>
                {t("achievements.chooseFeaturedSave")}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={enterSelectionMode}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("achievements.chooseFeatured")}
            >
              <Text style={styles.headerAction}>{t("achievements.chooseFeatured")}</Text>
            </Pressable>
          )
        }
      />

      {selectionMode && (
        <View style={styles.selectionHint}>
          <Feather name="info" size={13} color={colors.muted} />
          <Text variant="muted" style={styles.selectionHintText}>
            {selectedIds.length >= MAX_FEATURED_ACHIEVEMENTS
              ? t("achievements.chooseFeaturedLimitReached")
              : t("achievements.chooseFeaturedHint")}
          </Text>
        </View>
      )}

      {/*
        * Aviso NÃO-BLOQUEANTE (ver `syncError` acima) — some assim que
        * uma sincronização der certo (manual ou automática). De
        * propósito NÃO substitui a grade por uma tela cheia de erro:
        * o último estado conhecido (cache ou já sincronizado) continua
        * visível por baixo, mesmo espírito "stale-while-revalidate"
        * do resto desta tela.
        */}
      {syncError && (
        <View style={styles.syncErrorBanner}>
          <Feather name="alert-triangle" size={15} color={colors.danger} />
          <Text variant="muted" style={styles.syncErrorText}>
            {t("error.syncAchievementsFailed")}
          </Text>
          <Button variant="outline" onPress={() => retrySyncRef.current()}>
            {t("error.tryAgain")}
          </Button>
        </View>
      )}

      <FlatList
        data={ACHIEVEMENTS}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const unlocked = state.unlocked[item.id];
          const progress = progressFor(item, state);
          const isSelected = selectionMode && selectedIds.includes(item.id);
          // Ver `isNewAndUncelebrated` — único critério de "novo" em
          // toda a tela, idêntico ao que a tela de detalhe usa pra
          // decidir se celebra.
          const isNew = isNewAndUncelebrated(item.id, state);

          function handlePress() {
            if (selectionMode) {
              if (unlocked) toggleSelected(item.id);
              return;
            }
            router.push(`/profile/achievements/${item.id}`);
          }

          return (
            <Pressable
              style={[styles.tile, { width: cardWidth }]}
              onPress={handlePress}
              accessibilityRole="button"
              accessibilityLabel={isNew ? `${t(item.titleKey)}, ${t("achievements.new")}` : t(item.titleKey)}
            >
              <View
                style={[
                  styles.imageWrap,
                  isSelected && styles.imageWrapSelected,
                  // Bloqueado, dentro do modo de seleção: fica visualmente apagado — reforça que não é tocável aqui (regra do pedido, "apenas emblemas já desbloqueados").
                  selectionMode && !unlocked && styles.imageWrapUnselectable,
                ]}
              >
                {/*
                 * CAUSA RAIZ (2026-10-16, a pedido — vídeo mostrando o
                 * brilho como um quadrado solto e a pill "NOVO" longe
                 * do emblema) — `newSweepClip`/`Image` eram dois
                 * IRMÃOS soltos dentro de `imageWrap` (ambos com
                 * `width`/`height: imageSize`, um absoluto, um não).
                 * Na teoria um filho `position: "absolute"` não deveria
                 * contar pro tamanho automático do pai — mas, na
                 * prática, o `imageWrap` ficou mais ALTO do que o
                 * próprio emblema, empurrando `newBadge`/`selectedCheck`
                 * (ancorados nele, `top: -4`) pra longe do emblema de
                 * verdade. Em vez de depender dessa sutileza de layout,
                 * `imageStack` abaixo é um `View` ÚNICO, com tamanho
                 * FIXO (`imageSize x imageSize`) explícito — tanto o
                 * recorte do brilho quanto a imagem ficam DENTRO dele,
                 * então `imageWrap` só enxerga UM filho de tamanho
                 * certo, sem ambiguidade nenhuma. `newBadge`/
                 * `selectedCheck` continuam irmãos de `imageStack`
                 * (não mudaram de lugar), voltando a ficar coladas no
                 * canto do emblema de verdade.
                 */}
                <View style={{ width: imageSize, height: imageSize }}>
                  {/*
                   * CAUSA RAIZ DE VERDADE (2026-10-16, a pedido — vídeo
                   * mostrando "a animação parece está por trás do
                   * emblema agora", DEPOIS de já ter corrigido o
                   * alinhamento das coberturas — ou seja, não era (só)
                   * posição). A `Image` SEMPRE foi o ÚLTIMO filho aqui
                   * (pintada por cima de tudo abaixo dela) — então o
                   * brilho, numa camada ABAIXO da imagem, só aparecia
                   * onde a imagem tem pixel TRANSPARENTE (fora do
                   * hexágono, na margem do PNG). Dentro do hexágono
                   * (onde a imagem é opaca), o brilho sempre esteve
                   * escondido debaixo da arte — por mais preciso que o
                   * recorte ficasse, ele nunca apareceria ali. Isso
                   * explica a sequência toda: no bug original ("é um
                   * quadrado") o vazamento na margem era grande, então
                   * o brilho aparecia ali, fora do emblema; cada
                   * correção desde então só apertou esse vazamento, até
                   * quase zerá-lo de vez — daí a impressão de que o
                   * brilho "sumiu atrás" do emblema (na real, ele nunca
                   * tinha ficado visível POR CIMA da arte).
                   *
                   * CORREÇÃO: `Image` agora é o PRIMEIRO filho (embaixo
                   * de tudo) e o brilho (`newSweepClip`/gradiente,
                   * semi-transparente — `rgba(255,255,255,0.55)`) vem
                   * DEPOIS, por cima — assim ele ilumina de verdade os
                   * pixels do emblema ao passar. As coberturas
                   * (`sweepCoverRects`) continuam por cima de tudo, pra
                   * nunca deixar o brilho vazar na margem transparente
                   * (mesmo papel de antes, só que agora também tapando
                   * o brilho por cima da própria imagem nos cantos, não
                   * só por cima do fundo).
                   */}
                  <Image
                    source={unlocked ? item.colorImage : item.lockedImage}
                    style={{ width: imageSize, height: imageSize }}
                    resizeMode="contain"
                  />
                  {/*
                   * Redução de movimento: nenhum brilho extra — a pill
                   * "NOVO" abaixo já comunica o estado sozinha, mesma
                   * regra que o resto do app segue pra essa preferência.
                   */}
                  {isNew && !reducedMotion && (
                    <>
                      {/*
                       * RECORTE PRECISO NO HEXÁGONO, SEM LIB NOVA
                       * (2026-10-16) — ver comentário grande junto de
                       * `SWEEP_HEX_BANDS`/`SWEEP_HEX_BOUNDS`, no topo
                       * do arquivo, pra origem completa das medidas.
                       * 1) `newSweepClip`: a caixa delimitadora
                       * (`overflow: "hidden"`, insets precisos medidos
                       * nos 28 PNGs reais) — já bem mais apertada que
                       * a tentativa anterior, mas ainda é um retângulo
                       * (os 4 cantos/afunilamentos do hexágono ainda
                       * vazam aqui).
                       */}
                      <View
                        pointerEvents="none"
                        style={[
                          styles.newSweepClip,
                          {
                            top: sweepClipInsetY,
                            left: sweepClipInsetX,
                            right: sweepClipInsetX,
                            bottom: sweepClipInsetY,
                          },
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.newSweepStrip,
                            {
                              width: sweepStripWidth,
                              height: imageSize * 1.9,
                              transform: [{ translateX: sweepTranslate }, { rotate: "18deg" }],
                            },
                          ]}
                        >
                          <LinearGradient
                            colors={["transparent", "rgba(255,255,255,0.55)", "transparent"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFillObject}
                          />
                        </Animated.View>
                      </View>
                      {/*
                       * 2) Coberturas: tapam exatamente os 4 cantos/
                       * afunilamentos que a caixa acima ainda deixa
                       * passar, na cor de fundo da tela
                       * (`colors.background`). AGORA (depois da
                       * correção de ordem — ver comentário grande junto
                       * da `Image`, logo acima dela no JSX) ficam por
                       * cima de TUDO — imagem real E brilho — porque o
                       * brilho passou a ficar ACIMA da imagem (pra
                       * iluminar a arte de verdade, não ficar escondido
                       * debaixo dela). Isso inverteu a rede de
                       * segurança de antes: antes uma cobertura
                       * agressiva demais era inofensiva (a imagem
                       * pintava por cima e corrigia sozinha); agora uma
                       * cobertura agressiva demais tapa arte de verdade
                       * pra sempre — por isso `SWEEP_HEX_BANDS` usa a
                       * UNIÃO mais generosa entre os 28 PNGs reais (o
                       * emblema mais LARGO da amostra define o limite,
                       * não o mais estreito — ver comentário grande
                       * junto da constante, no topo do arquivo, pra
                       * causa raiz completa do "emblemas corroídos"),
                       * pra nunca avançar sobre a arte de nenhum
                       * emblema.
                       */}
                      {/*
                       * CAUSA RAIZ (2026-10-16, a pedido — vídeo
                       * mostrando a animação "por trás do emblema", um
                       * recorte escalonado cortando a arte de verdade)
                       * — a versão anterior agrupava cada par de
                       * coberturas (esquerda/direita) dentro de um
                       * `View` com `top`/`height`, mas SEM
                       * `left`/`width` — sem esses dois, a posição
                       * horizontal desse agrupador fica ambígua pro
                       * Yoga, e o `left` de cada cobertura (relativo a
                       * ESSE wrapper, não à imagem) desalinhava do
                       * sistema de coordenadas real da imagem, tapando
                       * pedaço de arte de verdade em vez da margem
                       * transparente. Corrigido: nada de `View`
                       * agrupador nenhum — um `<>` (Fragment, sem nó
                       * nativo próprio, sem box model próprio) por
                       * faixa, com cada cobertura virando filha DIRETA
                       * do `View` `imageSize x imageSize` (a MESMA
                       * referência de coordenadas do `Image` real), com
                       * `top`/`left`/`width`/`height` 100% explícitos.
                       */}
                      {sweepCoverRects.map((rect, index) => (
                        <View
                          key={`left-${index}`}
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: rect.top,
                            left: rect.leftCoverLeft,
                            width: rect.leftCoverWidth,
                            height: rect.height,
                            backgroundColor: colors.background,
                            display: rect.leftCoverWidth > 0 ? "flex" : "none",
                          }}
                        />
                      ))}
                      {sweepCoverRects.map((rect, index) => (
                        <View
                          key={`right-${index}`}
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: rect.top,
                            left: rect.rightCoverLeft,
                            width: rect.rightCoverWidth,
                            height: rect.height,
                            backgroundColor: colors.background,
                            display: rect.rightCoverWidth > 0 ? "flex" : "none",
                          }}
                        />
                      ))}
                    </>
                  )}
                </View>
                {isSelected && (
                  <View style={styles.selectedCheck}>
                    <Feather name="check" size={12} color="#0a0e17" />
                  </View>
                )}
                {isNew && !isSelected && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>{t("achievements.new")}</Text>
                  </View>
                )}
              </View>
              {/*
               * `textBlock`: nome + progresso num único bloco com
               * `minHeight` fixo (reserva a altura da PIOR hipótese —
               * nome de 2 linhas + progresso — em todo card da grade,
               * pra alinhar linha com linha). Dentro dele, o nome
               * ocupa só a altura do próprio texto (sem `height` fixo
               * individual) e o progresso fica logo abaixo com um
               * `marginTop` pequeno (4-6px) — assim a distância
               * nome→progresso fica curta mesmo quando o nome é de 1
               * linha só, em vez de "herdar" um vão vazio de uma caixa
               * de 2 linhas.
               */}
              <View style={styles.textBlock}>
                <Text numberOfLines={2} style={[styles.tileName, !unlocked && styles.tileNameLocked]}>
                  {t(item.titleKey)}
                </Text>
                {/* SEMPRE renderizado (mesmo desbloqueado) — só fica invisível (`opacity: 0`), pra reservar a MESMA altura em todo card da grade. Sem isso, um card desbloqueado na mesma linha de um bloqueado ficaria mais baixo, desalinhado. */}
                <Text style={[styles.tileProgress, unlocked && styles.tileProgressHidden]}>
                  {t("achievements.progress", { current: progress, total: item.target })}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.primary,
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
  selectionHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  selectionHintText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  syncErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  syncErrorText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  imageWrap: {
    borderRadius: radius.full,
    padding: 3,
  },
  imageWrapSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  imageWrapUnselectable: {
    opacity: 0.35,
  },
  selectedCheck: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * RECORTE PRECISO NO HEXÁGONO, SEM LIB NOVA (2026-10-16) — ver
   * `SWEEP_HEX_BANDS`/`SWEEP_HEX_BOUNDS` no topo do arquivo pra causa
   * raiz completa. `newSweepClip` é a caixa delimitadora retangular
   * (`overflow: "hidden"`, insets precisos vindos de
   * `SWEEP_HEX_BOUNDS`) — os 4 cantos que ela ainda deixa passar são
   * tapados pelos retângulos de `sweepCoverRects`, renderizados como
   * irmãos logo depois desta view no JSX.
   */
  newSweepClip: {
    position: "absolute",
    overflow: "hidden",
  },
  // A faixa de luz em si — mais alta que a caixa (`height` com folga)
  // e girada, pra cruzar na diagonal mesmo com o recorte retangular.
  newSweepStrip: {
    position: "absolute",
    top: "-45%",
    left: 0,
  },
  // Selo "Novo" — pílula âmbar no canto superior direito do emblema,
  // mesma cor/família de `colors.primary` já usada em toda pílula do
  // app (ver `gel`/`gelBlue` em `theme.ts`, aqui só texto+fundo, sem
  // gradiente — emblema pequeno demais pra um efeito gel caber bem).
  newBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  newBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: "#1a1204",
    textTransform: "uppercase",
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  row: {
    gap: GRID_GAP_HORIZONTAL,
    marginBottom: GRID_GAP_VERTICAL,
    // CAUSA RAIZ do espaço vertical entre linhas (histórico) — ver
    // comentário no topo do arquivo. Sem isso, o padrão do Yoga
    // ("stretch") estica todo card da linha pra altura do mais alto.
    alignItems: "flex-start",
  },
  tile: {
    alignItems: "center",
  },
  // Reserva a altura da PIOR hipótese (nome 2 linhas + progresso) —
  // ver comentário grande no topo do arquivo (pedidos 1 e 2).
  textBlock: {
    marginTop: spacing.xs,
    minHeight: 46,
    alignItems: "center",
  },
  tileName: {
    textAlign: "center",
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 14,
  },
  tileNameLocked: {
    color: colors.muted,
  },
  tileProgress: {
    marginTop: 5,
    textAlign: "center",
    fontSize: fontSize.micro,
    lineHeight: 14,
    color: colors.muted,
  },
  // Reserva a altura (sempre renderizado), só esconde visualmente.
  tileProgressHidden: {
    opacity: 0,
  },
});
