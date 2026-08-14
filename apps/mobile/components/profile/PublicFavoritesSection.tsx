import { useMemo } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { usePublicFavorites } from "@/lib/usePublicProfile";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function PublicFavoritesSection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { items, isLoading } = usePublicFavorites(userId);

  const favoriteSeries = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const favoriteMovies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);

  if (isLoading) return null;
  if (favoriteSeries.length === 0 && favoriteMovies.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      {favoriteSeries.length > 0 && <FavoritesRow title={t("profile.favoriteSeries")} items={favoriteSeries} />}
      {favoriteMovies.length > 0 && <FavoritesRow title={t("profile.favoriteMovies")} items={favoriteMovies} />}
    </View>
  );
}

function FavoritesRow({ title, items }: { title: string; items: LibraryItem[] }) {
  const router = useRouter();

  return (
    <View>
      <Text variant="subtitle" style={styles.title}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => {
          const posterUrl = tmdbImageUrl(item.posterPath, "w342");
          const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
          return (
            <Pressable key={`${item.mediaType}-${item.id}`} style={styles.card} onPress={() => router.push(href)}>
              <View style={styles.posterWrapper}>
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
                ) : (
                  <Feather name="film" size={18} color={colors.muted} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 104;

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
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
  cardTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
});
