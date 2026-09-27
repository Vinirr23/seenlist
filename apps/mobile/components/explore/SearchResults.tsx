import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { MediaSearchResult } from "@seenlist/types";
import { useSearchMedia } from "@/lib/useSearchMedia";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Skeleton } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize, elevation } from "@/lib/theme";

export function SearchResults({ query }: { query: string }) {
  const { data, isLoading, isError } = useSearchMedia(query);
  const { t } = useTranslation();

  if (!query.trim()) {
    return <EmptyState message={t("search.promptSearch")} />;
  }
  if (isLoading) {
    // CORREÇÃO (auditoria de consistência, 2026-09-25 — "esqueleto sem
    // shimmer, só uma View opaca") — era uma `View` lisa
    // (`colors.surface`), sem a animação que todo outro esqueleto do
    // app tem (componente `Skeleton`, ver comentário de causa raiz
    // nele). Reaproveita `Skeleton` na mesma forma do card real
    // (pôster 56×84 + duas linhas de texto), em vez de inventar um
    // formato novo — não é `AvatarRowSkeleton` (avatar redondo) nem
    // `LibraryGridSkeleton` (pôster de grade quadriculada): nenhum dos
    // dois tem essa forma "pôster retangular + texto ao lado".
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton width={56} height={84} borderRadius={radius.sm} />
            <View style={styles.cardInfo}>
              <Skeleton width={48} height={14} borderRadius={radius.full} />
              <Skeleton width="70%" height={14} />
              <Skeleton width="30%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (isError) {
    return <EmptyState message={t("search.errorSearch")} />;
  }
  if (!data || data.length === 0) {
    return <EmptyState message={t("search.noResults")} />;
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
  const router = useRouter();
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");
  const { t } = useTranslation();

  function handlePress() {
    if (item.mediaType === "series") {
      router.push(`/series/${item.id}`);
      return;
    }
    router.push(`/movies/${item.id}`);
  }

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={18} color={colors.muted} />
          </View>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.mediaType === "movie" ? t("media.movie") : t("media.series")}</Text>
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
    // CORREÇÃO (auditoria de consistência) — card de conteúdo dentro
    // de lista, mesma natureza de `ReviewCard`/`PostCard`/comentário,
    // que já ganharam elevação. Sem isso, a busca era a única lista
    // do app com card totalmente plano.
    ...elevation.low,
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
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.micro` (era literal 10, mesmo valor).
    fontSize: fontSize.micro,
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
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    textAlign: "center",
  },
});
