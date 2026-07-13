import { View, Image, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Text } from "@/components/ui";

const COLUMNS = 3;
const GAP = spacing.sm;

export interface PosterGridProps {
  items: LibraryItem[];
  onPressItem?: (item: LibraryItem) => void;
  /** TASK-116 — cor da barra inferior (categoria do Perfil). Quando presente, substitui a barra de progresso — o web nunca mostra as duas juntas. */
  barColor?: string;
}

/**
 * TASK-091/116/120 — equivalente nativo do `PosterGrid.tsx` do web.
 * Duas variantes, igual ao web: com barra de PROGRESSO (Séries/
 * Filmes, abas principais) ou com barra de COR fixa por categoria
 * (Perfil → Séries/Filmes/Favoritos) — nunca as duas ao mesmo tempo.
 *
 * Correção (TASK-120): a largura do pôster era calculada UMA VEZ, no
 * carregamento do módulo (`Dimensions.get("window")` fora de
 * qualquer componente) — no Android, isso às vezes roda antes da
 * ponte nativa terminar de informar o tamanho real da tela, dando um
 * valor errado e congelado (aparecia como 2 colunas espremidas em
 * vez de 3). `useWindowDimensions()` dentro do componente resolve
 * isso: recalcula a cada render, com o valor certo.
 */
export function PosterGrid({ items, onPressItem, barColor }: PosterGridProps) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <PosterGridItem key={`${item.mediaType}-${item.id}`} item={item} onPress={onPressItem} barColor={barColor} cardWidth={cardWidth} />
      ))}
    </View>
  );
}

function PosterGridItem({
  item,
  onPress,
  barColor,
  cardWidth,
}: {
  item: LibraryItem;
  onPress?: (item: LibraryItem) => void;
  barColor?: string;
  cardWidth: number;
}) {
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");
  const progressPercent =
    !barColor && item.progress && item.progress.totalEpisodes > 0
      ? Math.round((item.progress.watchedEpisodes / item.progress.totalEpisodes) * 100)
      : null;

  return (
    <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => onPress?.(item)}>
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={24} color={colors.muted} />
          </View>
        )}
        {progressPercent !== null && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        )}
        {!!barColor && <View style={[styles.progressTrack, { height: 5, backgroundColor: barColor }]} />}
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      {!!item.year && <Text style={styles.year}>{item.year}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  card: {},
  posterWrapper: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  year: {
    fontSize: 11,
    color: colors.muted,
  },
});
