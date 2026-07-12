import { View, Image, StyleSheet, Pressable, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { Text } from "@/components/ui";

const COLUMNS = 3;
const GAP = spacing.sm;
// Largura de cada pôster: (largura da tela - padding lateral da Screen - os gaps entre colunas) / 3.
const CARD_WIDTH = (Dimensions.get("window").width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

export interface PosterGridProps {
  items: LibraryItem[];
  onPressItem?: (item: LibraryItem) => void;
}

/**
 * TASK-091 (Séries nativa) — equivalente nativo do `PosterGrid.tsx`
 * do web (grade de 3 colunas, pôster 2:3, barra de progresso na base
 * quando a série tem episódios). Toque no pôster ainda não abre uma
 * tela de detalhes — essa tela é o próximo passo natural depois da
 * fundação, não faz parte desta leva; por isso `onPressItem` é
 * opcional e as telas que usam isto mostram um aviso simples por
 * enquanto.
 */
export function PosterGrid({ items, onPressItem }: PosterGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <PosterGridItem key={`${item.mediaType}-${item.id}`} item={item} onPress={onPressItem} />
      ))}
    </View>
  );
}

function PosterGridItem({ item, onPress }: { item: LibraryItem; onPress?: (item: LibraryItem) => void }) {
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");
  const progressPercent =
    item.progress && item.progress.totalEpisodes > 0
      ? Math.round((item.progress.watchedEpisodes / item.progress.totalEpisodes) * 100)
      : null;

  return (
    <Pressable style={styles.card} onPress={() => onPress?.(item)}>
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
  card: {
    width: CARD_WIDTH,
  },
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
