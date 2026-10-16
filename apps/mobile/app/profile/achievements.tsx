import { useEffect, useState } from "react";
import { Image, Pressable, FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Screen, ScreenHeader, Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACHIEVEMENTS,
  evaluateAndUnlockAchievements,
  fetchAchievementsState,
  progressFor,
  type AchievementsState,
} from "@/lib/achievements";

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
 * Enquanto a busca real não volta, a grade começa com tudo bloqueado/
 * 0 (sem skeleton dedicado — mesmo "pisca rápido e assenta" aceitável
 * aqui, tela secundária, sem dado sensível à primeira impressão como
 * o Perfil tem).
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

const EMPTY_STATE: AchievementsState = {
  unlocked: { maratonista: false, madrugada: false, "amante-de-filmes": false, classicos: false },
  unlockedAt: {},
  moviesWatchedCount: 0,
};

export default function AchievementsScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<AchievementsState>(EMPTY_STATE);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      await evaluateAndUnlockAchievements(userId);
      const fresh = await fetchAchievementsState(userId);
      if (!cancelled) setState(fresh);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const cardWidth = Math.floor((width - spacing.md * 2 - GRID_GAP_HORIZONTAL * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const imageSize = Math.round(cardWidth * IMAGE_SCALE);

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("achievements.screenTitle")} />

      <FlatList
        data={ACHIEVEMENTS}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const unlocked = state.unlocked[item.id];
          const progress = progressFor(item, state);
          return (
            <Pressable
              style={[styles.tile, { width: cardWidth }]}
              onPress={() => router.push(`/profile/achievements/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={t(item.titleKey)}
            >
              <Image
                source={unlocked ? item.colorImage : item.lockedImage}
                style={{ width: imageSize, height: imageSize }}
                resizeMode="contain"
              />
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
