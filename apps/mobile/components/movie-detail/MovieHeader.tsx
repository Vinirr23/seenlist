import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { MovieDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export function MovieHeader({ movie, watched }: { movie: MovieDetails; watched: boolean }) {
  const router = useRouter();
  const backdropUrl = tmdbImageUrl(movie.backdropPath, "w780");
  const posterUrl = tmdbImageUrl(movie.posterPath, "w342");
  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;

  return (
    <View>
      <View style={styles.backdropWrapper}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={styles.backdrop} resizeMode="cover" />
        ) : (
          <View style={[styles.backdrop, styles.backdropFallback]} />
        )}
        <View style={styles.overlay} />
      </View>

      <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
        <Feather name="arrow-left" size={18} color={colors.text} />
      </Pressable>

      <View style={styles.headerRow}>
        <View style={styles.posterWrapper}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={styles.posterFallback}>
              <Feather name="film" size={20} color={colors.muted} />
            </View>
          )}
          {watched && (
            <View style={styles.watchedBadge}>
              <Feather name="check" size={10} color={colors.background} />
              <Text style={styles.watchedBadgeText}>Assistido</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text variant="subtitle" numberOfLines={2}>
            {movie.title}
          </Text>
          {movie.originalTitle !== movie.title && (
            <Text variant="muted" numberOfLines={1} style={styles.originalTitle}>
              {movie.originalTitle}
            </Text>
          )}
          <Text variant="muted" style={styles.meta}>
            {[year, movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : null].filter(Boolean).join(" · ")}
          </Text>
          {movie.genres.length > 0 && (
            <Text variant="muted" numberOfLines={1} style={styles.meta}>
              {movie.genres.join(", ")}
            </Text>
          )}
          <View style={styles.ratingRow}>
            <Feather name="star" size={13} color={colors.primary} />
            <Text style={styles.rating}>{movie.voteAverage.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const POSTER_WIDTH = 96;
const POSTER_HEIGHT = 144;

const styles = StyleSheet.create({
  backdropWrapper: {
    height: 180,
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
    backgroundColor: "rgba(11,14,20,0.35)",
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
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -POSTER_HEIGHT / 2.2,
  },
  posterWrapper: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
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
  watchedBadge: {
    position: "absolute",
    right: 4,
    top: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  watchedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.background,
  },
  info: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xs,
    gap: 2,
  },
  originalTitle: {
    fontSize: 11,
  },
  meta: {
    fontSize: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  rating: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
  },
});
