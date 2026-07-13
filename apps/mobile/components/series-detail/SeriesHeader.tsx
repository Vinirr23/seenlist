import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export function SeriesHeader({
  series,
  watchedCount,
  totalEpisodes,
  onMorePress,
}: {
  series: SeriesDetails;
  watchedCount: number;
  totalEpisodes: number;
  onMorePress: () => void;
}) {
  const router = useRouter();
  const backdropUrl = tmdbImageUrl(series.backdropPath, "w780");
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const showProgress = totalEpisodes > 0;
  const percentage = showProgress ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const seasonsLabel = `${series.numberOfSeasons} ${series.numberOfSeasons === 1 ? "temporada" : "temporadas"}`;

  return (
    <View style={styles.wrapper}>
      {backdropUrl ? (
        <Image source={{ uri: backdropUrl }} style={styles.backdrop} resizeMode="cover" />
      ) : (
        <View style={[styles.backdrop, styles.backdropFallback]} />
      )}
      <View style={styles.overlay} />

      <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
        <Feather name="arrow-left" size={18} color={colors.text} />
      </Pressable>

      <Pressable style={styles.moreButton} onPress={onMorePress} hitSlop={8}>
        <Feather name="more-horizontal" size={18} color={colors.text} />
      </Pressable>

      <View style={[styles.textBlock, { bottom: showProgress ? 28 : 12 }]}>
        <Text variant="title" style={styles.title}>
          {series.title}
        </Text>
        <Text style={styles.meta}>{[year, seasonsLabel, series.genres[0]].filter(Boolean).join(" · ")}</Text>
      </View>

      {showProgress && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
          <Text style={styles.progressText}>{percentage}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 240,
    width: "100%",
    backgroundColor: colors.surface,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFallback: {
    backgroundColor: colors.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,14,20,0.55)",
  },
  backButton: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11,14,20,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreButton: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11,14,20,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
  },
  title: {
    color: "#FFFFFF",
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  progressRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
