import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

/**
 * CORREÇÃO (a pedido — auditoria mais rigorosa) — evita
 * `Intl.NumberFormat({ notation: "compact" })` de propósito: é o
 * mesmo tipo de API "avançada" do `Intl` que já derrubou o Feed em
 * produção (`Intl.RelativeTimeFormat`, sem suporte garantido no
 * Hermes dependendo do build). Mais vale um formato mais simples e
 * SEGURO do que arriscar outro crash igual, por uma linha de nota.
 */
function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} mil`;
  return String(n);
}

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
        <Image source={{ uri: backdropUrl }} style={styles.backdrop} contentFit="cover" />
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
        {series.voteAverage > 0 && (
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={13} color={colors.primary} />
            <Text style={styles.ratingValue}>{series.voteAverage.toFixed(1)}</Text>
            {series.voteCount > 0 && (
              <Text style={styles.ratingCount}>· {formatCompactCount(series.voteCount)} avaliações</Text>
            )}
          </View>
        )}
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
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  ratingCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
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
