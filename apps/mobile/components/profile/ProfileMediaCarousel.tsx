import { useEffect, useRef, useState } from "react";
import { View, Pressable, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchDisplaySummariesCached, tmdbImageUrl, type MediaSummary } from "@/lib/library";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const PAGE_SIZE = 20;
/**
 * CORREÇÃO (bug real, reportado — "os cards de perfil [...] não estão
 * com o mesmo tamanho do web", 2026-09-03) — era `96×144` (largura
 * fixa 96, proporção ~2:3 aproximada por acaso). O web usa `w-36
 * aspect-[2/3]` (144px de largura, proporção 2:3 exata → 216px de
 * altura) em TODO carrossel de pôster do Perfil/Explorar
 * (`ProfileMediaCarousel.tsx`, `DiscoverCard.tsx`) — mesmo valor já
 * usado certo no `DiscoverCarousel.tsx` deste app (mobile), só este
 * componente (e `PublicMediaCarousel.tsx`, mesmo bug, mesma correção)
 * tinham ficado pra trás com o valor antigo, menor. `POSTER_HEIGHT`
 * fixo saiu — a altura agora vem de `aspectRatio: 2/3` (igual ao
 * `aspect-[2/3]` do web), não de um número fixo independente da
 * largura.
 */
const POSTER_WIDTH = 144;

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
  const { locale } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(0);
  const [summaryMap, setSummaryMap] = useState<Record<number, MediaSummary>>({});
  const fetchedUpTo = useRef(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    fetchedUpTo.current = 0;
    setSummaryMap({});
    setVisibleCount(Math.min(PAGE_SIZE, ids.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, locale]);

  useEffect(() => {
    if (visibleCount <= fetchedUpTo.current) return;
    const newIds = ids.slice(fetchedUpTo.current, visibleCount);
    fetchedUpTo.current = visibleCount;
    fetchDisplaySummariesCached(mediaType === "movie" ? newIds : [], mediaType === "series" ? newIds : [], locale).then((result) => {
      const newMap = mediaType === "movie" ? result.movies : result.series;
      setSummaryMap((prev) => ({ ...prev, ...newMap }));
    });
  }, [visibleCount, ids, mediaType, locale]);

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
        <Pressable onPress={() => router.push(emptyHref ?? href)}>
          <Glass style={styles.emptyCard}>
            <Feather name="plus" size={22} color={colors.muted} />
            <Text style={styles.emptyText}>{emptyLabel}</Text>
          </Glass>
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
                <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. `marginBottom`
  // (ritmo vertical entre seções) NÃO foi tocado — fora do escopo.
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); o web usa `mb-3` (`ProfileMediaCarousel.tsx`, cabeçalho clicável) = 12px — sem token exato, valor literal. */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.xs` (4); o web usa `gap-2` (`ProfileMediaCarousel.tsx`, ícone+título) = 8px. */
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.sm` (8); os estados "carregando"/vazio no web usam o MESMO `mb-3` (12px) do cabeçalho clicável (`ProfileMediaCarousel.tsx`), não um valor menor à parte. */
  sectionTitleStandalone: {
    marginBottom: 12,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `fontSize.md` (16) / `"700"`; o web usa `text-lg font-extrabold` (`ProfileMediaCarousel.tsx`, título de cada carrossel) = 18px / peso 800. */
  sectionTitleText: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: colors.text,
  },
  row: {
    gap: spacing.sm,
  },
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
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
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.xs` (4); o web usa `gap-2` (`ProfileMediaCarousel.tsx`, card de convite vazio) = 8px. */
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
