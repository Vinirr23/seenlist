import { memo } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { ListWithPreview } from "@/lib/lists";
import { tmdbImageUrl } from "@/lib/library";
import { PressableScale, Text, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";

/**
 * REDESIGN "MINHAS LISTAS" (2026-10-07, aprovado pelo usuário — ver
 * `claude/SEENLIST-FEATURE-2026-10-07-redesign-minhas-listas.md`) —
 * substitui a linha horizontal (ícone+nome+seta) por um mosaico
 * quadrado feito dos próprios pôsteres da lista, como capa de uma
 * coleção. Reaproveita `ListWithPreview.previewPosters` (já vem de
 * `fetchMyListsWithPreview`, até 4 itens, mais recente primeiro — sem
 * consulta nova, sem N+1 por card).
 *
 * A PEDIDO EXPLÍCITO — "sem excesso de Glass/contorno competindo com
 * as imagens": o mosaico em si (1/2/3/4 pôsteres reais) NÃO usa
 * `Glass` nenhum — é `Image` puro lado a lado, só com um fio de 2px na
 * cor de fundo do app entre os ladrilhos (pra separar visualmente sem
 * virar moldura). `Glass` (variant "subtle") fica reservado só pro
 * caso de lista SEM nenhum pôster (0 títulos) — aí não tem imagem
 * nenhuma competindo, então o vidro não pesa.
 */
const TILE_GAP = 2;

export const ListCollectionCard = memo(function ListCollectionCard({
  list,
  cardWidth,
  onPress,
  itemsLabel,
}: {
  list: ListWithPreview;
  cardWidth: number;
  onPress: () => void;
  /** "X títulos" já formatado/traduzido (singular/plural resolvidos por quem chama). */
  itemsLabel: string;
}) {
  // LISTA COMPARTILHADA (2026-10-06) — o sinal de "duas pessoas" que
  // antes era um ícone na linha horizontal agora é um selo discreto
  // no canto do mosaico (mesma receita de controle flutuante sobre
  // imagem — `scrim.control` — já usada no botão de voltar/"+" sobre
  // capa em outras telas), em vez de competir com o espaço de texto
  // abaixo.
  const isShared = !!list.coOwner || list.isCoOwnedByMe;

  return (
    <PressableScale style={{ width: cardWidth }} onPress={onPress}>
      <View style={[styles.mosaic, { width: cardWidth, height: cardWidth }]}>
        <Mosaic posters={list.previewPosters} />
        {isShared && (
          <View style={styles.sharedBadge}>
            <Feather name="users" size={11} color="#fff" />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {list.name}
      </Text>
      <Text variant="muted" style={styles.count}>
        {itemsLabel}
      </Text>
    </PressableScale>
  );
});

/**
 * "Criar lista" como último item do próprio grid, em vez do botão
 * amarelo gigante que havia antes — mesma célula/dimensões dos cards
 * de lista, aparência secundária (borda tracejada sutil, sem `GelSurface`
 * nenhum). Mantém o fluxo de criação existente: só troca o GATILHO
 * que abre o formulário (`showForm`), a lógica de `createList` em
 * `lib/lists.ts` não muda.
 */
export const CreateListCard = memo(function CreateListCard({ cardWidth, onPress, label }: { cardWidth: number; onPress: () => void; label: string }) {
  return (
    <PressableScale style={{ width: cardWidth }} onPress={onPress}>
      <View style={[styles.createMosaic, { width: cardWidth, height: cardWidth }]}>
        <Feather name="plus" size={22} color={colors.primary} />
      </View>
      <Text numberOfLines={1} style={[styles.name, styles.createLabel]}>
        {label}
      </Text>
    </PressableScale>
  );
});

function Mosaic({ posters }: { posters: (string | null)[] }) {
  if (posters.length === 0) {
    return (
      <Glass style={styles.emptyFill} variant="subtle">
        <Feather name="film" size={28} color={colors.muted} style={{ opacity: 0.6 }} />
      </Glass>
    );
  }

  if (posters.length === 1) {
    return <Tile posterPath={posters[0]} style={styles.fill} />;
  }

  if (posters.length === 2) {
    return (
      <View style={styles.row}>
        <Tile posterPath={posters[0]} style={styles.flexFill} />
        <Tile posterPath={posters[1]} style={styles.flexFill} />
      </View>
    );
  }

  if (posters.length === 3) {
    // 1 pôster grande à esquerda (ocupa as duas linhas) + 2 empilhados à direita.
    return (
      <View style={styles.row}>
        <Tile posterPath={posters[0]} style={styles.flexFill} />
        <View style={[styles.column, styles.flexFill]}>
          <Tile posterPath={posters[1]} style={styles.flexFill} />
          <Tile posterPath={posters[2]} style={styles.flexFill} />
        </View>
      </View>
    );
  }

  // 4+ — grid 2×2 com os 4 mais recentes (quem chama já limitou a 4).
  return (
    <View style={styles.column}>
      <View style={[styles.row, styles.flexFill]}>
        <Tile posterPath={posters[0]} style={styles.flexFill} />
        <Tile posterPath={posters[1]} style={styles.flexFill} />
      </View>
      <View style={[styles.row, styles.flexFill]}>
        <Tile posterPath={posters[2]} style={styles.flexFill} />
        <Tile posterPath={posters[3]} style={styles.flexFill} />
      </View>
    </View>
  );
}

/**
 * Um ladrilho do mosaico. Título sem `posterPath` cai no mesmo
 * fallback do resto do app (`PosterGrid`/`ProfileListsPreview`):
 * ícone mudo sobre `colors.surface`, nunca um pôster inventado.
 *
 * `posterPath` aceita `undefined` além de `null` — `posters[i]`
 * (array `(string | null)[]`) é indexado por posição fixa (0..3), e
 * com `noUncheckedIndexedAccess` o TS tipa esse acesso como
 * `T | undefined`, mesmo quando a lógica de quem chama já garantiu
 * o tamanho do array antes de ler aquele índice.
 */
function Tile({ posterPath, style }: { posterPath: string | null | undefined; style: object }) {
  const posterUrl = tmdbImageUrl(posterPath ?? null, "w342");
  return (
    <View style={[style, styles.tile]}>
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.tileImage} contentFit="cover" />
      ) : (
        <View style={styles.tileFallback}>
          <Feather name="film" size={16} color={colors.muted} style={{ opacity: 0.5 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mosaic: {
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: colors.background,
    position: "relative",
  },
  sharedBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: scrim.control,
  },
  emptyFill: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  fill: { width: "100%", height: "100%" },
  flexFill: { flex: 1 },
  row: { flex: 1, flexDirection: "row", gap: TILE_GAP },
  column: { flex: 1, flexDirection: "column", gap: TILE_GAP },
  tile: { overflow: "hidden" },
  tileImage: { width: "100%", height: "100%" },
  tileFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  name: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  count: {
    fontSize: fontSize.xxs,
    marginTop: 2,
  },
  createMosaic: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  createLabel: {
    color: colors.muted,
    fontWeight: "600",
  },
});
