import { useEffect, useRef, useState } from "react";
import { View, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchDisplaySummaries, tmdbImageUrl, type MediaSummary } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const PAGE_SIZE = 20;
const POSTER_WIDTH = 96;
const POSTER_HEIGHT = 144;

/**
 * Porta de `ProfileMediaCarousel.tsx` do web — recebe a lista de IDs
 * já ordenada por atividade (`profileMediaCarousel.ts`) e busca
 * resumo (pôster/título) só de quem está visível, em lotes de 20,
 * carregando mais conforme a lista rola até o fim (`FlatList` +
 * `onEndReached`, equivalente ao listener de scroll do web — não tem
 * `IntersectionObserver`/scroll de DOM no React Native).
 */
export function ProfileMediaCarousel({
  icon,
  label,
  href,
  mediaType,
  ids,
  isLoadingIds,
  emptyLabel,
  emptyHref,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  href: string;
  mediaType: "movie" | "series";
  ids: number[];
  isLoadingIds: boolean;
  emptyLabel?: string;
  emptyHref?: string;
}) {
  const router = useRouter();
  const [visibleCount, setVisibleCount] = useState(0);
  const [summaryMap, setSummaryMap] = useState<Record<number, MediaSummary>>({});
  const fetchedUpTo = useRef(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    fetchedUpTo.current = 0;
    setSummaryMap({});
    setVisibleCount(Math.min(PAGE_SIZE, ids.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (visibleCount <= fetchedUpTo.current) return;
    const newIds = ids.slice(fetchedUpTo.current, visibleCount);
    fetchedUpTo.current = visibleCount;
    fetchDisplaySummaries(mediaType === "movie" ? newIds : [], mediaType === "series" ? newIds : []).then((result) => {
      const newMap = mediaType === "movie" ? result.movies : result.series;
      setSummaryMap((prev) => ({ ...prev, ...newMap }));
    });
  }, [visibleCount, ids, mediaType]);

  function loadMore() {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, ids.length));
  }

  if (isLoadingIds) {
    return (
      <View style={styles.section}>
        <View style={[styles.sectionTitle, styles.sectionTitleStandalone]}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[0, 1, 2, 3, 4, 5]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.row}
          renderItem={() => <View style={styles.skeleton} />}
        />
      </View>
    );
  }

  if (ids.length === 0) {
    // "Séries"/"Filmes" vazios: não mostra nada (biblioteca vazia,
    // não é um convite a fazer nada específico). Só favoritos (que
    // passam emptyLabel) mostram o card de convite.
    if (!emptyLabel) return null;
    return (
      <View style={styles.section}>
        <View style={[styles.sectionTitle, styles.sectionTitleStandalone]}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <Pressable style={styles.emptyCard} onPress={() => router.push(emptyHref ?? href)}>
          <Feather name="plus" size={22} color={colors.muted} />
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </Pressable>
      </View>
    );
  }

  const visibleIds = ids.slice(0, visibleCount);

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => router.push(href)}>
        <View style={styles.sectionTitle}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </Pressable>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={visibleIds}
        keyExtractor={(id) => String(id)}
        contentContainerStyle={styles.row}
        onEndReachedThreshold={0.5}
        onEndReached={loadMore}
        renderItem={({ item: id }) => {
          const summary = summaryMap[id];
          const posterUrl = tmdbImageUrl(summary?.posterPath ?? null, "w185");
          const itemHref = mediaType === "movie" ? `/movies/${id}` : `/series/${id}`;
          return (
            <Pressable style={styles.poster} onPress={() => router.push(itemHref)}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
              ) : summary ? (
                <View style={styles.posterPlaceholder}>
                  <Feather name="film" size={18} color={colors.muted} style={{ opacity: 0.4 }} />
                </View>
              ) : (
                <View style={styles.skeleton} />
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionTitleStandalone: {
    marginBottom: spacing.sm,
  },
  sectionTitleText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    gap: spacing.sm,
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
