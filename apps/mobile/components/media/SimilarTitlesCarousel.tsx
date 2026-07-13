import { ScrollView, View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-100 — porta de `SimilarTitlesCarousel.tsx` do web
 * (`components/media/`, já compartilhado lá entre `SimilarMoviesCarousel`
 * e `SimilarSeriesCarousel` — aqui nem precisou de dois wrappers,
 * um componente só serve os dois). Os dados (`series.similar`/
 * `movie.similar`) já vêm de graça na mesma resposta que os detalhes
 * — nenhuma chamada nova precisou ser feita.
 */
export function SimilarTitlesCarousel({ items }: { items: MediaSearchResult[] }) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => {
        const posterUrl = tmdbImageUrl(item.posterPath, "w342");
        const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
        return (
          <Pressable key={`${item.mediaType}-${item.id}`} style={styles.card} onPress={() => router.push(href)}>
            <View style={styles.posterWrapper}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={styles.posterFallback}>
                  <Feather name="film" size={18} color={colors.muted} />
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const CARD_WIDTH = 104;

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
  },
  posterWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
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
  title: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
});
