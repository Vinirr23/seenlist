import { useEffect, useRef, useState } from "react";
import { View, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Screen, Text, Glass, GlassTargetProvider, AmbientGlow, GLOW_IMAGE, parseGlowColor, Skeleton } from "@/components/ui";
import { ActivityTypeChip } from "@/components/feed/ActivityCard";
import { colors, spacing, radius, fontSize, elevation } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_THEMES,
  EMPTY_ACHIEVEMENTS_STATE,
  evaluateAndUnlockAchievements,
  fetchAchievementsState,
  fetchAchievementRarity,
  isNewAndUncelebrated,
  markAchievementCelebrated,
  progressFor,
  type AchievementId,
  type AchievementsState,
} from "@/lib/achievements";

/**
 * PILOTO — tela DEDICADA de detalhe de uma conquista
 * (`/profile/achievements/[id]`), 2026-10-15. Substitui o antigo
 * modal/bottom-sheet (`achievements.tsx` tinha isso antes) — pedido
 * explícito, referência enviada (mockup do GPT aprovado): tela cheia
 * própria, com seta de voltar flutuante (mesmo estilo de
 * `MovieHeader.tsx`/`SeriesHeader.tsx` — `Glass variant="icon"`,
 * 36×36, canto 12/12), SEM a barra de navegação embaixo (escondida em
 * `app/_layout.tsx`, mesmo mecanismo já usado por `week-review` e
 * `season-recap`) — por isso NÃO usa `<ScreenHeader>` (o próprio
 * componente documenta que não é pra telas hero/detail).
 *
 * Conquistado: emblema grande, nome, descrição, bloco "conquista
 * desbloqueada" com ícone de confirmação, e botão de compartilhar.
 *
 * REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
 * primeiros") — `unlocked`/`progress`/`unlockedAt` vinham de
 * `DEMO_UNLOCKED`/`DEMO_PROGRESS`/`DEMO_UNLOCKED_AT` (sem banco). Ao
 * abrir esta tela, chama `evaluateAndUnlockAchievements` (confere os
 * critérios de verdade no Postgres e grava o que for novo) e depois
 * `fetchAchievementsState` (lê o estado real). A data de desbloqueio
 * agora é a de verdade (`unlocked_at` da tabela `user_achievements`),
 * não mais um campo vazio de propósito.
 *
 * COMPARTILHAR — REMOVIDO DE PROPÓSITO (2026-10-16, a pedido — "não
 * ativa o compartilhar ainda não, na verdade tira ele, depois
 * adicionamos de novo"). Existia um botão desabilitado aqui antes; foi
 * removido por completo (não só escondido) até decidirmos construir a
 * função de compartilhar de verdade. Se for readicionar, procurar este
 * comentário.
 *
 * Bloqueado: emblema cinza grande, nome, bloco de progresso com barra
 * + "X de Y" (reaproveita `achievements.progress`, já traduzido nos 3
 * idiomas), e a explicação de como desbloquear (`requirementKey`) —
 * mesmo texto que já existia no modal antigo, sem inventar um segundo
 * texto diferente só pra bater 100% com a referência visual (ela tinha
 * duas frases parecidas; nosso modelo de dados só tem uma por estado).
 *
 * EXPERIÊNCIA VISUAL (2026-10-16, a pedido — "as telas do emblemas são
 * estaticas, quero que seja mais uma experiencia" + review encaminhado
 * do GPT sobre o espaço vazio abaixo do card de progresso) — depois de
 * 3 e depois 10 opções de mockup (`SendUserFile`, não publicadas — era
 * "preciso de ideias e mockup para escolher", sinal de escolha única,
 * não de algo pra revisitar), decisão final do usuário, literal:
 * "gostei do fundo tematico + raridade social + brilho ambar e emblema
 * flutuando" — explicitamente SEM confete (fazia parte da opção 1 do
 * mockup, mas não foi mencionado na escolha final). Depois, ao ver uma
 * captura com um anel de raridade em volta do emblema, instrução
 * explícita: "na raridade social, não coloca o circulo ao redor do
 * emblema" — por isso o selo de raridade abaixo é só texto, sem
 * nenhum anel/contorno desenhado sobre o emblema.
 *
 * As 4 peças, cada uma plugada num ponto já existente:
 * 1. Fundo temático — `ACHIEVEMENT_THEMES[achievement.id].blobs` no
 *    `AmbientGlow` que já envolve a tela (mesmo mecanismo de
 *    `GlassTargetProvider`+`AmbientGlow` usado em toda sub-página do
 *    app, só com uma paleta por emblema em vez da genérica).
 * 2. Brilho âmbar (ou a cor do tema) + emblema flutuando — halo local
 *    (`GLOW_IMAGE`, o mesmo PNG pré-desfocado do `AmbientGlow`,
 *    tingido com `theme.haloColor`) respirando opacidade+escala atrás
 *    do emblema, com o emblema em si subindo/descendo devagar
 *    (`Animated.View` + Reanimated, mesma lib/padrão já usado em
 *    `EpisodeWatchedButton.tsx`).
 * 3. Estrelas piscando — só quando `theme.showStars` (hoje só
 *    Madrugada, por ser o único tema de "noite"), um punhado de
 *    pontinhos com opacidade piscando em fases diferentes.
 * 4. Raridade social — `fetchAchievementRarity()` (função nova
 *    `get_achievement_rarity`, cálculo agregado no Postgres — ver
 *    migration `20261016000000`), mostrada tanto desbloqueado quanto
 *    bloqueado (decisão do usuário — bloqueado funciona como
 *    incentivo). Busca independente do login do usuário (estatística
 *    pública do app, não dado pessoal), por isso corre num
 *    `useEffect` próprio, sem esperar `userId`.
 *
 *    PENDÊNCIA CONHECIDA (2026-10-16, a pedido — "a porcentagem de
 *    raridade merece atenção... precisa vir de dados reais, com uma
 *    definição consistente de quem entra na base") — o backend desta
 *    função (`get_achievement_rarity`) hoje usa `count(*) from
 *    profiles` como denominador, ou seja, TODO cadastro que já
 *    existiu, mesmo quem nunca assistiu nada. Isso dilui a porcentagem
 *    artificialmente. NÃO mexi nisso ainda — o usuário ainda não
 *    escolheu qual definição de "usuário elegível" usar (3 opções
 *    apresentadas, decisão pendente). Mudar o denominador é uma
 *    migration separada, fora do escopo desta mudança (celebração de
 *    desbloqueio).
 *
 * CELEBRAÇÃO DE DESBLOQUEIO (2026-10-16, a pedido — "quero melhorar a
 * experiência de desbloqueio... sem exagerar") — mockup aprovado
 * (`SendUserFile`, simulação em CSS só pra validar timing/composição,
 * não publicado — escolha única de novo), decisão do usuário: "pode
 * implementar".
 *
 * A PERGUNTA CENTRAL — "isso é um desbloqueio de verdade, ou só uma
 * visita à tela de um emblema já desbloqueado antes?" — tinha duas
 * respostas tentadas antes, as duas com causa raiz documentada em
 * `achievements.tsx` ("CAUSA RAIZ — ANIMAÇÃO DE DESBLOQUEIO NUNCA
 * TOCAVA..."): (1) comparar snapshots de estado no cliente (frágil,
 * quebra em qualquer remontagem) e (2) usar o array devolvido por
 * `evaluateAndUnlockAchievements` nesta chamada (só funciona se ESTA
 * tela for a primeira a gravar o desbloqueio — nunca funciona pra um
 * emblema já desbloqueado antes dessa lógica existir, que é
 * exatamente o caso relatado: "nenhuma das conquistas fez a
 * animação").
 *
 * CORREÇÃO DE RAIZ (2026-10-16, migration
 * `20261017000009_user_achievements_celebrated_at.sql`): a resposta
 * certa não é um evento passageiro de UMA chamada de função, é um FATO
 * persistente guardado no banco — `user_achievements.celebrated_at`.
 * `isNewAndUncelebrated(achievement.id, state)` (mesma função usada
 * pela grade pro selo "Novo", `lib/achievements.ts`) é a fonte única
 * de "isso ainda não foi celebrado" — nunca diverge entre as duas
 * telas, porque as duas leem o MESMO campo do MESMO
 * `AchievementsState`, e esse campo sobrevive a remontagem de
 * componente, fechar o app, e até trocar de aparelho.
 *
 * `isCelebrating` é simplesmente essa checagem (só depois que
 * `isLoading` vira `false`, pra nunca celebrar em cima de um estado
 * ainda não confirmado). Assim que a celebração dispara (efeito
 * abaixo), a tela chama `markAchievementCelebrated(achievement.id)` —
 * grava `celebrated_at = now()` nesta linha — pra que NENHUMA
 * abertura futura (nem desta tela, nem a grade) volte a tratar este
 * emblema como novo. Um `useRef` (`celebrationStartedRef`) garante que
 * a sequência de animação roda UMA vez por montagem mesmo que o efeito
 * que a dispara rode de novo (ex.: React StrictMode em dev chamando
 * efeitos duas vezes).
 *
 * ANIMAÇÃO EXISTENTE — PRESERVADA SEM MUDANÇA DE COMPORTAMENTO —
 * `floatY`/`haloPulse`/`haloScale` continuam exatamente como estavam
 * (looping contínuo, sempre ativo, independente de celebração). A
 * única peça que a celebração precisa tocar é a ESCALA do emblema
 * (85%→105%→100%, novo `scaleBadge`) — como o Reanimated não faz
 * merge de arrays `transform` entre dois `useAnimatedStyle`
 * diferentes (o segundo simplesmente substitui o primeiro no RN), a
 * flutuação (`translateY`) e a escala de celebração foram combinadas
 * num único `useAnimatedStyle` (`heroTransformStyle`) com os dois
 * valores no mesmo array `transform` — não é uma animação nova
 * duplicando a antiga, é a mesma `floatY` de sempre, só compartilhando
 * o estilo com `scaleBadge` (que fica parado em `1` fora da
 * celebração, ou seja, zero efeito prático quando não está
 * celebrando).
 *
 * REFEITA (2026-10-16, a pedido — vídeo mostrando a celebração "bem
 * sutil, quase imperceptível, não transmite uma experiência" + mockup
 * de 10 opções, escolha do usuário: "opção 2 + opção 4, primeiro gira
 * e depois confete") — a versão anterior (pop de escala 85%→105%→100%
 * + "cometa" girando por fora + 9 partículas de 3-6px de UMA cor só)
 * ficava visualmente fraca: a janela de carregamento (esperando o
 * `fetchAchievementsState`, ~2s no vídeo analisado) já consumia a
 * atenção antes de qualquer animação começar, e o que vinha depois
 * (escala quase nenhuma, partículas minúsculas somem em 750ms) mal
 * registrava.
 *
 * SEQUÊNCIA NOVA, duas fases nítidas (daí a ordem do pedido — "primeiro
 * gira e depois confete"):
 * 1. GIRO (`flipRotate`, 0°→360° em ~700ms, câmera com leve
 *    perspectiva) — o próprio emblema gira no eixo Y, tipo moeda,
 *    combinado no MESMO `heroTransformStyle` que já tinha a
 *    flutuação/escala (mesma técnica de antes, só com mais um
 *    `transform` no array — Reanimated não faz merge de dois
 *    `useAnimatedStyle` diferentes).
 * 2. CONFETE (`buildCelebrationParticles`, atrasado pra só começar
 *    depois que o giro termina) — 16 partículas RETANGULARES
 *    (`borderRadius` pequeno, não mais um círculo) em 5 cores do tema
 *    do app (`colors.primary/secondary/success/info/like` — a mesma
 *    paleta já usada no resto do app, não cores novas inventadas),
 *    maior alcance (90-150px) e GIRANDO cada uma (`rotateEnd`
 *    aleatório) enquanto voa, com uma leve "gravidade" (a queda
 *    acelera com o tempo, não é um movimento reto) — lê muito mais
 *    como confete de verdade do que a versão de pontinhos antes.
 *
 * Tudo o que É novo (pulso extra de luz, partículas de confete, texto
 * "Conquista desbloqueada!") continua vivendo dentro de
 * `<CelebrationBurst>`, montado SÓ durante a janela da celebração
 * (`showCelebration`, ver `CELEBRATION_DURATION_MS`) — depois disso
 * desmonta por completo, sem nenhum custo contínuo de
 * renderização/worklet sobrando. Reaproveita o mesmo
 * `GLOW_IMAGE`/`parseGlowColor` já usados pelo halo contínuo (nenhum
 * asset novo), e o mesmo padrão de partícula individual já usado em
 * `TwinklingStars`/`Star` (cada partícula com seu próprio
 * `useSharedValue`, mesma convenção do arquivo).
 *
 * REMOVIDO: o "cometa" girando por fora do emblema (`sweepRotate`/
 * `sweepOpacity`, antigo `CelebrationBurst`) — não fazia parte da
 * combinação escolhida (giro + confete); o giro agora é do PRÓPRIO
 * emblema, não de um elemento girando em volta dele.
 *
 * SEM `react-native-svg`/lib de máscara (não são dependência do
 * projeto hoje) — o giro usa só `transform: [rotateY]` nativo do RN
 * (suportado sem nenhuma lib extra); o confete usa `View`s simples
 * (retângulos com `borderRadius` pequeno), mesma técnica de sempre.
 *
 * REDUÇÃO DE MOVIMENTO — `useReducedMotion()` (Reanimated, lê a
 * preferência do sistema). Quando ativa, a celebração NÃO roda (sem
 * pop de escala, sem cometa, sem partículas, sem pulso extra, sem
 * texto animado) — a tela abre direto no estado final de "desbloqueado",
 * idêntico a uma visita normal. Só afeta a celebração nova; a
 * flutuação/respiração contínua existente não foi alterada (não foi
 * pedido, e mudar isso seria uma decisão maior fora do escopo desta
 * tarefa).
 */

// Posições das estrelas dentro da caixa do emblema (240×240, ver
// `heroWrap`) — espalhadas à mão pra não ficarem simétricas/robóticas
// demais, com atrasos diferentes pra não piscarem todas juntas.
const STAR_POSITIONS: { top: number; left: number; size: number; delay: number }[] = [
  { top: 6, left: 34, size: 3, delay: 0 },
  { top: 36, left: 202, size: 2, delay: 450 },
  { top: 196, left: 18, size: 2, delay: 900 },
  { top: 168, left: 212, size: 3, delay: 250 },
  { top: 72, left: 112, size: 2, delay: 650 },
  { top: 214, left: 128, size: 2, delay: 1100 },
];

// Duração total da celebração (ver comentário grande no topo do
// arquivo) — REAJUSTADA (2026-10-16, sequência giro→confete) pra
// cobrir: giro (700ms) + atraso até o confete começar (~650ms) + o
// confete em si (até ~1000ms de voo) + o texto entrando depois disso
// e sumindo (termina por volta de 2,8s) — com uma pequena folga pra
// não cortar o fade final do texto.
const CELEBRATION_DURATION_MS = 2900;

// Paleta do confete — as MESMAS 5 cores já usadas em todo o resto do
// app (`lib/theme.ts`), nenhuma cor nova inventada só pra este efeito.
const CONFETTI_COLORS = [colors.primary, colors.secondary, colors.success, colors.info, colors.like];

// Partículas do confete — ângulo/distância/tamanho/cor/rotação final/
// atraso de cada uma, calculados uma vez (não é aleatório a cada
// render — só quando o componente de celebração monta, que já só
// acontece uma vez por desbloqueio real).
//
// `delay` começa em ~650ms (não ~90ms como na versão antiga) de
// propósito — é o que garante a ordem pedida ("primeiro gira e depois
// confete"): o giro (`flipRotate`, no componente pai) já levou 700ms
// sozinho, então o confete só começa a aparecer quando ele está
// terminando, nunca ANTES ou ao mesmo tempo.
function buildCelebrationParticles(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count + (Math.random() * 0.6 - 0.3);
    const distance = 90 + Math.random() * 60;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 10,
      size: 5 + Math.random() * 4,
      // `?? colors.primary` só pro TS (projeto usa
      // `noUncheckedIndexedAccess` — o módulo garante índice válido,
      // mas o compilador não tem como saber disso só pelo cálculo;
      // mesmo ajuste já feito em `WhatToWatchSheet.tsx` nesta sessão).
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] ?? colors.primary,
      rotateEnd: Math.random() * 440 - 220,
      delay: 620 + Math.random() * 260,
    };
  });
}

export default function AchievementDetailScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const reducedMotion = useReducedMotion();

  const [state, setState] = useState<AchievementsState>(EMPTY_ACHIEVEMENTS_STATE);
  const [rarity, setRarity] = useState<Partial<Record<AchievementId, number>>>({});
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationStartedRef = useRef(false);
  // CAUSA RAIZ — ENTRADA BRUSCA/CINZA (2026-10-17, bug reportado:
  // "fica cinza por uns segundos e muda pra conquistada de forma
  // brusca") — antes, `state` nascia de `EMPTY_ACHIEVEMENTS_STATE`
  // (tudo bloqueado) e a tela renderizava esse estado "bloqueado" como
  // se fosse real enquanto a busca (`evaluateAndUnlockAchievements` +
  // `fetchAchievementsState`, ambas obrigatoriamente sequenciais —
  // a segunda só pode ler DEPOIS que a primeira grava) ainda estava em
  // andamento — pra depois trocar pro estado real de uma vez, sem
  // transição. `isLoading` marca essa janela explicitamente: enquanto
  // `true`, a tela mostra um esqueleto neutro (nem bloqueado nem
  // desbloqueado — `Skeleton`, mesmo componente/estilo "shimmer" já
  // usado no resto do app) em vez de insinuar um estado que pode nem
  // ser o real; quando os dados chegam, o conteúdo de verdade entra
  // com um fade suave (`FadeIn`, Reanimated) em vez de aparecer na
  // hora.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    // Capturado aqui fora — dentro de `load()` (função aninhada,
    // assíncrona) o TypeScript não carrega a checagem acima, mesmo
    // sendo o mesmo valor (limitação conhecida do controle de fluxo
    // do TS através de closures assíncronas, achado real ao rodar
    // `tsc --noEmit` — mesmo idioma já usado em `useCurrentUser.ts`).
    const currentUserId = userId;
    let cancelled = false;

    async function load() {
      // Valor de retorno não é mais usado pra decidir celebração — ver
      // comentário grande no topo do arquivo. A chamada continua
      // necessária (é ela que confere os critérios e grava o
      // desbloqueio no banco).
      //
      // try/catch ADICIONADO (2026-10-20, consequência direta da
      // correção de raiz em `fetchAchievementsState` — ver comentário
      // grande lá) — até agora essa função nunca lançava exceção
      // (uma falha de leitura virava silenciosamente "nada
      // desbloqueado", sem erro), então esta tela nunca precisou
      // tratar rejeição aqui. Agora que ela propaga erro de verdade
      // (correção necessária pra `runSync()` da grade de Conquistas
      // conseguir detectar e reagir à mesma falha), sem este
      // try/catch uma falha de rede faria `isLoading` nunca virar
      // `false` — o esqueleto (`Skeleton`) ficaria girando pra sempre
      // em vez de, na pior hipótese, mostrar o estado padrão
      // (bloqueado), que é o mesmo comportamento degradado que esta
      // tela já tinha ANTES desta correção pra este caso específico —
      // não piora nada, só evita travar em carregamento infinito.
      try {
        await evaluateAndUnlockAchievements(currentUserId);
        const fresh = await fetchAchievementsState(currentUserId);
        if (!cancelled) {
          setState(fresh);
        }
      } catch (error) {
        console.error("[achievements] Falha ao carregar estado na tela de detalhe", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Raridade é estatística AGREGADA do app (não depende de quem está
  // logado) — roda sozinha, sem esperar `userId`, pra não atrasar o
  // selo atrás de um login que nem é necessário pra calculá-la.
  useEffect(() => {
    let cancelled = false;

    fetchAchievementRarity().then((data) => {
      if (!cancelled) setRarity(data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // `achievement`/`theme` calculados ANTES dos hooks de animação
  // (mesmo quando não encontrado) — os hooks (`useSharedValue`/
  // `useAnimatedStyle`) têm que ser chamados incondicionalmente em
  // toda renderização (regra do React), então o "não encontrado" só
  // pode retornar DEPOIS deles, não antes.
  const achievement = ACHIEVEMENTS.find((item) => item.id === id);
  // Usado só pra alimentar os hooks de animação abaixo (chamados
  // incondicionalmente) ANTES do retorno antecipado de "não
  // encontrado" — a versão não-opcional (`theme`, usada no JSX de
  // verdade) é recalculada depois desse retorno, já com `achievement`
  // estreitado pelo TypeScript como definido.
  const themeForAnim = achievement ? ACHIEVEMENT_THEMES[achievement.id] : undefined;
  // Única fonte de verdade de "ainda não celebrado" — ver comentário
  // grande no topo do arquivo. `!isLoading` evita celebrar em cima do
  // `EMPTY_ACHIEVEMENTS_STATE` inicial (que sempre reportaria
  // `unlocked: false`, nunca `true`, mas por clareza/robustez contra
  // mudança futura do estado vazio, a checagem fica explícita mesmo
  // assim).
  const isCelebrating = achievement && !isLoading ? isNewAndUncelebrated(achievement.id, state) : false;
  // `tintColor` do RN não respeita o canal alpha de forma confiável
  // (mesmo motivo documentado em `Glass.tsx`, `parseGlowColor`) — por
  // isso a cor do halo entra sólida (`haloTint`) e a opacidade (alpha
  // original × a respiração animada) é aplicada separada, no estilo.
  const { tint: haloTint, opacity: haloBaseOpacity } = themeForAnim
    ? parseGlowColor(themeForAnim.haloColor)
    : { tint: "transparent", opacity: 0 };

  // Respiração do halo + flutuação do emblema — iniciadas uma vez,
  // em loop infinito (`withRepeat(..., -1, ...)`), independente de
  // qual emblema é (a cor vem de `haloTint`, calculado acima). NÃO
  // alterado pela celebração — ver comentário grande no topo do
  // arquivo.
  const floatY = useSharedValue(0);
  const haloPulse = useSharedValue(0.5);
  const haloScale = useSharedValue(1);

  // Escala da celebração (85%→105%→100%) — parada em `1` fora da
  // celebração, combinada com `floatY` num único `useAnimatedStyle`
  // (`heroTransformStyle`, abaixo) pra não pisar na flutuação já
  // existente.
  const scaleBadge = useSharedValue(1);
  // Giro do próprio emblema (0°→360°, fase 1 da celebração — "primeiro
  // gira") — mesmo motivo de `scaleBadge`: combinado no MESMO
  // `heroTransformStyle`, não um estilo separado.
  const flipRotate = useSharedValue(0);
  // Pulso extra de luz atrás do emblema, só durante a celebração —
  // camada SEPARADA da respiração contínua (`haloPulse`/`haloScale`),
  // pra não alterar o comportamento dela. Timing novo: dispara perto
  // do FIM do giro, não do início — reforça o momento da "revelação".
  const burstGlowScale = useSharedValue(0.7);
  const burstGlowOpacity = useSharedValue(0);
  // Texto flutuante "Conquista desbloqueada!".
  const celebrateTextOpacity = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    haloPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.45, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  // Dispara a celebração UMA vez por montagem, só quando
  // `isCelebrating` vira `true` (ver comentário grande no topo do
  // arquivo pra por que esse sinal já é seguro contra remontagem) e só
  // se o sistema não estiver pedindo redução de movimento.
  useEffect(() => {
    if (!isCelebrating || celebrationStartedRef.current || !achievement) return;
    celebrationStartedRef.current = true;
    // Marca como celebrado IMEDIATAMENTE ao decidir celebrar — não
    // espera a animação terminar. O gatilho real, pelo pedido do
    // usuário, é "abrir a tela" ("a pessoa aperta e abre a tela com a
    // animação... e o novo já não aparece mais"), não "a animação
    // terminou de tocar". Também roda no caminho de redução de
    // movimento (abaixo) — sem isso, quem usa essa preferência veria o
    // selo "Novo" voltar pra sempre, já que nunca passaria por aqui
    // marcado.
    markAchievementCelebrated(achievement.id);

    if (reducedMotion) {
      // Preferência do sistema respeitada: nenhuma animação extra
      // roda, a tela já abre no estado final de desbloqueado (o
      // card/raridade abaixo já renderizam normalmente, sem depender
      // da celebração).
      return;
    }
    setShowCelebration(true);

    // FASE 1 — GIRO (ver comentário grande no topo do arquivo). O
    // emblema gira uma volta completa no eixo Y em 700ms; a escala
    // acompanha com um leve "respiro" (contrai/expande) pra o giro não
    // parecer um objeto 2D girando no vácuo.
    flipRotate.value = withTiming(360, { duration: 700, easing: Easing.out(Easing.cubic) });
    scaleBadge.value = withSequence(
      withTiming(0.92, { duration: 320, easing: Easing.inOut(Easing.quad) }),
      withTiming(1.08, { duration: 260, easing: Easing.out(Easing.back(1.3)) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) })
    );
    // Flash de luz no MOMENTO em que o giro termina (~700ms) — marca a
    // "revelação", logo antes do confete começar.
    burstGlowOpacity.value = withDelay(
      620,
      withSequence(
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
        withTiming(0.4, { duration: 380, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })
      )
    );
    burstGlowScale.value = withDelay(
      620,
      withSequence(
        withTiming(1.6, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(1.15, { duration: 380, easing: Easing.inOut(Easing.quad) })
      )
    );
    // FASE 2 — CONFETE: cada `CelebrationParticle` já nasce com seu
    // próprio atraso (~620-880ms, ver `buildCelebrationParticles`) —
    // não precisa de nada aqui, só não disparar ANTES disso (não
    // dispara; o giro é o que ocupa os primeiros ~700ms).
    celebrateTextOpacity.value = withDelay(
      750,
      withSequence(
        withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 1300 }),
        withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) })
      )
    );

    const timeout = setTimeout(() => setShowCelebration(false), CELEBRATION_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [isCelebrating, reducedMotion]);

  // Flutuação (existente) + escala/giro de celebração (novo)
  // combinados num único `useAnimatedStyle` — ver comentário grande no
  // topo do arquivo pra por que não são estilos separados. `perspective`
  // antes de `rotateY` — sem ele o giro "achata" sem profundidade
  // nenhuma (comportamento padrão do RN pra transforms 3D).
  const heroTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { scale: scaleBadge.value },
      { perspective: 800 },
      { rotateY: `${flipRotate.value}deg` },
    ],
  }));
  // Multiplica a opacidade original do `rgba(...)` do tema pela
  // respiração (0.45–1) — assim um halo já mais sutil num tema (se
  // algum dia houver) continua proporcionalmente mais sutil, em vez
  // de todos respirarem na mesma faixa absoluta.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloBaseOpacity * haloPulse.value,
    transform: [{ scale: haloScale.value }],
  }));
  // `burstGlowStyle`/`sweepStyle`/`celebrateTextStyle` NÃO são mais
  // calculados aqui (eram passados como prop pro `CelebrationBurst`) —
  // CORREÇÃO (achado pelo `tsc`: `ReturnType<typeof useAnimatedStyle>`
  // sem o parâmetro de tipo explícito resolve pra um tipo amplo demais
  // nos overloads do Reanimated, que trava ao ser atribuído de volta a
  // `Animated.Image`/`Animated.Text` dentro do componente filho —
  // "overflow: scroll não é atribuível", um sintoma do tipo errado,
  // não do valor). Em vez de tipar a prop na mão, os `useAnimatedStyle`
  // passaram a ser chamados DENTRO do próprio `CelebrationBurst`, que
  // recebe só os `SharedValue` crus — mesma inferência de tipo que já
  // funciona sem anotação em `heroTransformStyle`/`haloStyle` aqui.

  if (!achievement) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <View style={styles.notFound}>
          <Text variant="muted">{t("achievements.notFound")}</Text>
        </View>
      </Screen>
    );
  }

  const theme = ACHIEVEMENT_THEMES[achievement.id];
  const unlocked = state.unlocked[achievement.id];
  const progress = progressFor(achievement, state);
  const ratio = Math.max(0, Math.min(1, progress / achievement.target));
  const unlockedAtRaw = state.unlockedAt[achievement.id];
  const unlockedAtLabel = unlockedAtRaw
    ? new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(unlockedAtRaw)
      )
    : null;
  const rarityPercent = rarity[achievement.id];

  return (
    <Screen padded={false}>
      {/*
       * CORREÇÃO (2026-10-16, a pedido — "aquele linha que resolvemos
       * antes está nas telas dos emblemas, logo abaixo do botão de
       * voltar") — MESMA causa raiz já documentada em
       * `app/lists/[id].tsx` (ver comentário grande lá, "essa linha
       * fica apenas depois de 'minhas listas'"): o `AmbientGlow` tem
       * posição FIXA (`top: -60`, ver `ACHIEVEMENT_THEMES`) relativa
       * ao PRÓPRIO `GlassTargetProvider`, não à tela inteira. Aqui o
       * `topBar`/`BackButton` estava FORA do `GlassTargetProvider`
       * (antes dele), então o anel de banding da mancha (ver
       * "DITHER — CAUSA RAIZ" em `Glass.tsx`) nascia bem na costura
       * entre o fundo chapado de `Screen` (atrás do botão de voltar)
       * e o fundo com dither do `GlassTargetProvider` logo abaixo —
       * exatamente a linha visível reportada. Fix idêntico ao das
       * outras 5+1 telas que usam este padrão: o cabeçalho/botão de
       * voltar entra DENTRO do `GlassTargetProvider`, que passa a
       * envolver a tela inteira — sem costura, mancha sempre no
       * mesmo lugar relativo.
       */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={theme.blobs} />}>
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
          <View style={styles.heroWrap}>
            <Animated.Image
              source={GLOW_IMAGE}
              resizeMode="stretch"
              style={[styles.halo, { tintColor: haloTint }, haloStyle]}
            />
            {theme.showStars && <TwinklingStars />}

            {showCelebration && (
              <CelebrationBurst
                haloTint={haloTint}
                burstGlowScale={burstGlowScale}
                burstGlowOpacity={burstGlowOpacity}
                celebrateTextOpacity={celebrateTextOpacity}
                // Reaproveita a MESMA chave já traduzida nos 3 idiomas
                // que o card permanente usa ("Conquista desbloqueada!")
                // — não cria uma chave nova com o texto duplicado.
                celebrateLabel={t("achievements.unlockedBadge")}
              />
            )}

            <Animated.View style={heroTransformStyle}>
              {isLoading ? (
                // Esqueleto neutro (ver comentário grande acima,
                // "CAUSA RAIZ — ENTRADA BRUSCA/CINZA") — nem o visual
                // bloqueado nem o desbloqueado, enquanto o estado real
                // ainda não chegou.
                <Skeleton width={220} height={220} borderRadius={110} />
              ) : (
                <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(280)}>
                  <Image
                    source={unlocked ? achievement.colorImage : achievement.lockedImage}
                    style={styles.heroImage}
                    resizeMode="contain"
                  />
                </Animated.View>
              )}
            </Animated.View>
          </View>

          <Text variant="title" style={styles.name}>
            {t(achievement.titleKey)}
          </Text>

          {isLoading ? (
            <View style={styles.skeletonStateBlock}>
              <Skeleton width={200} height={14} borderRadius={7} />
              <Skeleton width="100%" height={58} borderRadius={radius.md} style={styles.skeletonCard} />
            </View>
          ) : unlocked ? (
            <Animated.View
              style={styles.fadeInBlock}
              entering={reducedMotion ? undefined : FadeIn.duration(280)}
            >
              {/*
               * HIERARQUIA (2026-10-16, a pedido — "o nome e a
               * descrição estão relativamente pequenos... daria mais
               * contraste à descrição") — nome passou de
               * `variant="subtitle"` pra `variant="title"` (token
               * maior já existente em `Text.tsx`, não um tamanho
               * inventado na mão). Descrição continua `variant="muted"`
               * (mesmo tamanho de sempre — não foi pedido maior, só
               * mais contraste), com a cor sobrescrita pra
               * `colors.text` em `styles.description` em vez do
               * `colors.muted` padrão da variante.
               */}
              <Text variant="muted" style={styles.description}>
                {t(achievement.descriptionKey)}
              </Text>

              <View style={styles.unlockedBlock}>
                {/*
                 * CORREÇÃO (2026-10-16, a pedido — "muda o icone pra o
                 * icone que usamos no feed") — era um `Feather
                 * check-circle` avulso (só o traço, sem fundo). O selo
                 * padrão de "concluído" no resto do app é
                 * `ActivityTypeChip type="completed"`
                 * (`components/feed/ActivityCard.tsx`) — círculo
                 * preenchido na cor de sucesso com o ícone `check` por
                 * cima, não o contorno. Mesmo componente reaproveitado
                 * aqui, não uma cópia.
                 */}
                <ActivityTypeChip type="completed" size={20} iconSize={11} />
                <View style={styles.unlockedTextCol}>
                  <Text style={styles.unlockedText}>{t("achievements.unlockedBadge")}</Text>
                  {unlockedAtLabel && (
                    <Text variant="muted" style={styles.unlockedDate}>
                      {unlockedAtLabel}
                    </Text>
                  )}
                </View>
              </View>

              {typeof rarityPercent === "number" && (
                <View style={styles.rarityChip}>
                  {/*
                   * CORREÇÃO (2026-10-16, a pedido — "a estrela no app
                   * não está preenchida igual no mockup, deixe ela
                   * preenchida") — `Feather` não tem estrela
                   * preenchida (a família inteira é só contorno).
                   * Trocado por `MaterialCommunityIcons name="star"`,
                   * MESMO ícone preenchido que `StarRating.tsx` já usa
                   * pra avaliação com 1 estrela cheia — reaproveitando
                   * a convenção que já existe no app, não inventando
                   * uma nova.
                   */}
                  <MaterialCommunityIcons name="star" size={11} color={colors.primary} />
                  <Text style={styles.rarityChipText}>{t("achievements.rarity", { percent: rarityPercent })}</Text>
                </View>
              )}
            </Animated.View>
          ) : (
            <Animated.View
              style={styles.fadeInBlock}
              entering={reducedMotion ? undefined : FadeIn.duration(280)}
            >
              <Text variant="muted" style={styles.description}>
                {t(achievement.requirementKey)}
              </Text>

              <View style={styles.progressBlock}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressHeaderLabel}>{t("achievements.progressLabel")}</Text>
                  <Text style={styles.progressHeaderValue}>
                    {t("achievements.progress", { current: progress, total: achievement.target })}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
                </View>
              </View>

              {/*
               * Mostrado tanto bloqueado quanto desbloqueado (decisão
               * do usuário) — aqui funciona como incentivo ("só 14%
               * já conseguiram isso"), embaixo do card de progresso,
               * mesma posição relativa do card "Conquista
               * desbloqueada" no outro estado.
               */}
              {typeof rarityPercent === "number" && (
                <View style={styles.rarityChip}>
                  <MaterialCommunityIcons name="star" size={11} color={colors.primary} />
                  <Text style={styles.rarityChipText}>{t("achievements.rarity", { percent: rarityPercent })}</Text>
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

// Camada de estrelinhas piscando, só pro tema Madrugada
// (`theme.showStars`) — cada uma com seu próprio shared value e seu
// próprio atraso, pra não piscarem todas em sincronia.
function TwinklingStars() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {STAR_POSITIONS.map((star, index) => (
        <Star key={index} top={star.top} left={star.left} size={star.size} delay={star.delay} />
      ))}
    </View>
  );
}

function Star({ top, left, size, delay }: { top: number; left: number; size: number; delay: number }) {
  const twinkle = useSharedValue(0.25);

  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top,
          left,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#F4F1E8",
        },
        style,
      ]}
    />
  );
}

/**
 * Tudo o que é NOVO na celebração (ver comentário grande no topo do
 * arquivo) — montado só durante `showCelebration` (~2,2s) e desmontado
 * depois, sem nenhum custo contínuo. Recebe os `useAnimatedStyle` já
 * prontos do componente pai (orquestração de timing fica lá — aqui é
 * só apresentação) e monta, além deles, as partículas (cada uma com
 * seu próprio `useSharedValue`, mesmo padrão de `Star` acima).
 */
function CelebrationBurst({
  haloTint,
  burstGlowScale,
  burstGlowOpacity,
  celebrateTextOpacity,
  celebrateLabel,
}: {
  haloTint: string;
  burstGlowScale: SharedValue<number>;
  burstGlowOpacity: SharedValue<number>;
  celebrateTextOpacity: SharedValue<number>;
  celebrateLabel: string;
}) {
  // Calculado uma vez, na montagem (o componente inteiro só existe
  // durante a janela da celebração) — não precisa de `useMemo`, já que
  // não há motivo pra recalcular num componente que nunca re-renderiza
  // por mudança de props que afete isto. 16 partículas (era 9) — mais
  // cheio, mais "confete de verdade" (ver comentário em
  // `buildCelebrationParticles`).
  const particles = buildCelebrationParticles(16);

  // `useAnimatedStyle` chamado AQUI DENTRO (não mais no componente
  // pai, que só passa os `SharedValue` crus) — ver comentário grande
  // onde isto era calculado antes, no corpo de
  // `AchievementDetailScreen`, pra causa raiz completa do erro de tipo
  // que motivou essa mudança.
  const burstGlowStyle = useAnimatedStyle(() => ({
    opacity: burstGlowOpacity.value,
    transform: [{ scale: burstGlowScale.value }],
  }));
  const celebrateTextStyle = useAnimatedStyle(() => ({ opacity: celebrateTextOpacity.value }));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Pulso extra de luz atrás do emblema — camada separada do halo contínuo. */}
      <Animated.Image
        source={GLOW_IMAGE}
        resizeMode="stretch"
        style={[styles.burstGlow, { tintColor: haloTint }, burstGlowStyle]}
      />

      {particles.map((particle, index) => (
        <CelebrationParticle key={index} {...particle} />
      ))}

      <Animated.Text style={[styles.celebrateText, celebrateTextStyle]}>{celebrateLabel}</Animated.Text>
    </View>
  );
}

/**
 * Uma peça de confete — RETÂNGULO pequeno (não mais um círculo), com
 * cor própria e uma rotação final (`rotateEnd`) que gira enquanto voa,
 * mais uma "gravidade" leve (`GRAVITY * progress²` somado ao `dy`
 * linear — faz a queda acelerar com o tempo, em vez de um movimento
 * reto) — é essa combinação (retângulo + giro + queda) que lê como
 * confete de verdade, não só pontos se espalhando.
 */
const CONFETTI_GRAVITY = 60;

function CelebrationParticle({
  dx,
  dy,
  size,
  color,
  rotateEnd,
  delay,
}: {
  dx: number;
  dy: number;
  size: number;
  color: string;
  rotateEnd: number;
  delay: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 820, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.1 ? progress.value / 0.1 : 1 - (progress.value - 0.1) / 0.9,
    transform: [
      { translateX: dx * progress.value },
      { translateY: dy * progress.value + CONFETTI_GRAVITY * progress.value * progress.value },
      { rotate: `${rotateEnd * progress.value}deg` },
      { scale: 0.5 + progress.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: "50%",
          left: "50%",
          width: size,
          height: size * 1.8,
          borderRadius: 1.5,
          backgroundColor: color,
          marginTop: -(size * 1.8) / 2,
          marginLeft: -size / 2,
        },
        style,
      ]}
    />
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Glass style={styles.backButton} variant="icon">
      <Pressable
        style={styles.backButtonHit}
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Feather name="arrow-left" size={16} color={colors.text} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  backButtonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  // Mesmo padrão de `AmbientGlow` parado + `ScrollView` rolando por
  // cima já usado em toda sub-página do app (ver `settings/index.tsx`,
  // `glassFill`) — aqui o `AmbientGlow` recebe `theme.blobs` em vez de
  // uma paleta fixa, então cada emblema pinta sua própria atmosfera.
  glassFill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroWrap: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 300,
    height: 300,
  },
  // CORREÇÃO (achado pelo `tsc`: "Property 'heroImage' does not
  // exist") — ficou de fora na reescrita do arquivo pra celebração;
  // estilo original do emblema grande, sem nenhuma mudança de valor.
  heroImage: {
    width: 220,
    height: 220,
  },
  // Pulso extra de luz da celebração — mesmo tamanho/posição do halo
  // contínuo (`styles.halo`), mas é uma camada própria (opacidade
  // parte de 0, controlada só durante a celebração).
  burstGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    top: "50%",
    left: "50%",
    marginTop: -150,
    marginLeft: -150,
  },
  // REMOVIDO (2026-10-16): `sweepWrap`/`sweepComet` (o "cometa"
  // girando por fora do emblema) — substituído pelo giro do PRÓPRIO
  // emblema (`flipRotate`, no componente pai). Ver comentário grande
  // no topo do arquivo.
  celebrateText: {
    position: "absolute",
    top: 2,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  name: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  // CORREÇÃO (2026-10-16, a pedido — "ficou escondido... no mockup
  // fica abaixo do card de conquista desbloqueada") — era um `Text`
  // `muted` discreto logo abaixo do nome (mesma cor/tamanho da
  // descrição ao lado, por isso sumia). Virou chip — mesmo estilo
  // (`.rarity-chip`) do mockup aprovado (10 opções, "Raridade
  // social"): fundo/borda âmbar translúcidos, texto âmbar, pílula —
  // e saiu de perto do nome pra ficar DEPOIS do card de status
  // (`unlockedBlock`/`progressBlock`), não antes.
  rarityChip: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    backgroundColor: "rgba(232,163,61,0.1)",
    borderWidth: 1,
    borderColor: "rgba(232,163,61,0.3)",
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 4,
  },
  rarityChipText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  // Esqueleto neutro (ver "CAUSA RAIZ — ENTRADA BRUSCA/CINZA") e
  // bloco de fade-in do conteúdo real — mesma largura/centralização
  // dos blocos que substituem, pra não pular o layout quando o
  // conteúdo de verdade entra no lugar.
  skeletonStateBlock: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  skeletonCard: {
    marginTop: spacing.lg,
  },
  fadeInBlock: {
    width: "100%",
    alignItems: "center",
  },
  description: {
    marginTop: spacing.xs,
    textAlign: "center",
    maxWidth: 300,
    // HIERARQUIA (2026-10-16) — sobrescreve o `colors.muted` da
    // variante pra dar mais contraste, sem mudar o tamanho (não foi
    // pedido maior, só mais legível).
    color: colors.text,
  },
  unlockedBlock: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    width: "100%",
    maxWidth: 320,
  },
  unlockedTextCol: {
    flexShrink: 1,
  },
  unlockedText: {
    color: colors.success,
    fontWeight: "600",
    flexShrink: 1,
  },
  unlockedDate: {
    marginTop: 2,
    fontSize: fontSize.xs,
  },
  progressBlock: {
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressHeaderLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
  progressHeaderValue: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});
