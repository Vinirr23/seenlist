import { View, Image, Pressable, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MediaSearchResult } from "@seenlist/types";
import { useSearchMedia } from "@/lib/useSearchMedia";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const MEDIA_TYPE_LABEL: Record<"movie" | "series", string> = {
  movie: "Filme",
  series: "Série",
};

export function SearchResults({ query }: { query: string }) {
  const { data, isLoading, isError } = useSearchMedia(query);

  if (!query.trim()) {
    return <EmptyState message="Pesquise um filme ou série" />;
  }
  if (isLoading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonRow} />
        ))}
      </View>
    );
  }
  if (isError) {
    return <EmptyState message="Não foi possível buscar agora. Tente de novo em instantes." />;
  }
  if (!data || data.length === 0) {
    return <EmptyState message="Nenhum resultado encontrado" />;
  }

  return (
    <View style={styles.list}>
      {data.map((item) => (
        <ResultCard key={`${item.mediaType}-${item.id}`} item={item} />
      ))}
    </View>
  );
}

function ResultCard({ item }: { item: MediaSearchResult }) {
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");

  return (
    <Pressable
      style={styles.card}
      onPress={() => Alert.alert(item.title, "A tela de detalhes ainda vai ser construída — em breve.")}
    >
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={18} color={colors.muted} />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{MEDIA_TYPE_LABEL[item.mediaType]}</Text>
        </View>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </Text>
        {!!item.year && <Text variant="muted">{item.year}</Text>}
      </View>
    </Pressable>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text variant="muted" style={styles.emptyText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  posterWrapper: {
    width: 56,
    height: 84,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.background,
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
  cardInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  skeletonRow: {
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
  },
});
