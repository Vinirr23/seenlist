import { useMemo, type ReactNode } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { DiscoverItem } from "@/lib/discover";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { tmdbImageUrl } from "@/lib/library";
import { AddToLibraryButton } from "./AddToLibraryButton";
import { Screen, Text, Glass, PressableScale } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const NUM_COLUMNS = 3;
// "gap-3" (12px) no web — não é um dos degraus de `spacing.ts`
// (4/8/16/24/32/48), mesma situação de `CARD_WIDTH` em
// `DiscoverCarousel.tsx` — valor literal em vez de forçar um token
// que não bate exatamente.
const GRID_GAP = 12;

/**
 * PORTE DO WEB (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, você não adicionou essas coisas ao mobile [...]
 * implementa TUDO no mobile, não assuma nada, analise tudo") — base
 * compartilhada das 3 telas "ver todos" novas (`app/explore/all/
 * [list].tsx`, `app/explore/genre/[mediaType]/[genreId].tsx`,
 * `app/explore/similar/[mediaType]/[anchorId].tsx`), mesmo papel de
 * `DiscoverAllView.tsx`/`GenreAllView.tsx`/`SimilarAllView.tsx` do web
 * — que são praticamente idênticos entre si (cabeçalho com seta de
 * voltar + grade 3 colunas + rodapé "Carregar mais"), por isso virou
 * UM componente aqui em vez de 3 quase-cópias.
 *
 * Rolagem infinita — RN não tem `IntersectionObserver`
 * (`useInfiniteScrollSentinel.ts` do web usa isso); o equivalente
 * NATIVO de "carrega sozinho perto do fim" é o `onEndReached` do
 * próprio `FlatList`, usado abaixo. O botão "Carregar mais" continua
 * existindo do mesmo jeito (`ListFooterComponent`) — os dois chamam a
 * MESMA `fetchNextPage`, protegida contra chamada dupla por
 * `isFetchingNextPage` (ver `useDiscoverListInfinite`/etc. em
 * `useDiscoverList.ts`), mesmo raciocínio do comentário original do
 * web sobre não ter risco de duas buscas conflitantes.
 *
 * SEM `GlassTargetProvider` de propósito, verificado no código real do
 * web antes de assumir qualquer coisa: `DiscoverAllView.tsx`/
 * `GenreAllView.tsx`/`SimilarAllView.tsx` NÃO têm nenhuma camada de
 * manchas de cor atrás (diferente da aba Explorar principal, que tem
 * `ExploreView.tsx`'s 5 manchas azuis) — só fundo escuro liso atrás
 * dos cards de vidro. O `backdrop-blur` do web nessas 3 telas está,
 * na prática, borrando um fundo já liso (efeito visualmente nulo) — o
 * "vidro" que aparece vem inteiramente do gradiente branco sutil
 * pintado no PRÓPRIO card (`glass.gradientNeutral`), não de nada atrás
 * dele. `Glass` sem `GlassTargetProvider` (fallback documentado no
 * próprio componente — borda + gradiente, sem desfoque de verdade)
 * produz o mesmo resultado visual que o web tem aqui, então não faz
 * falta.
 */
export function DiscoverGridScreen({
  title,
  items,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  showItemTitles = false,
}: {
  /**
   * `ReactNode`, não `string` — a tela "porque você assistiu a X"
   * (`app/explore/similar/[mediaType]/[anchorId].tsx`) usa
   * `highlightTitle()` (mesma função de `DiscoverCarousel.tsx`) pra
   * colorir só o título da âncora dentro da frase, que retorna JSX,
   * não uma string pronta.
   */
  title: ReactNode;
  items: DiscoverItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /**
   * DiscoverAllView.tsx (web) mostra o título embaixo do pôster;
   * GenreAllView.tsx/SimilarAllView.tsx NÃO mostram — inconsistência
   * real do próprio web, conferida linha a linha nos 3 arquivos antes
   * de portar (não assumida) — reproduzida aqui do mesmo jeito, não
   * "corrigida" por conta própria.
   */
  showItemTitles?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { items: libraryItems } = useLibraryItems();

  // Mesmo filtro de `libraryKeys`/`useFilterOutLibraryItems` do web —
  // "ver todos" não deve mostrar o que já está na Biblioteca. Como
  // filtra por completo (não só o selo), nenhum item restante pode já
  // ter status — `AddToLibraryButton` sempre recebe `initialStatus:
  // null` abaixo, sem precisar buscar status nenhum (mesma economia
  // que o web faz aqui, sem chamada extra nenhuma).
  const libraryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of libraryItems ?? []) keys.add(`${item.mediaType}:${item.id}`);
    return keys;
  }, [libraryItems]);
  const visibleItems = useMemo(() => items.filter((item) => !libraryKeys.has(`${item.mediaType}:${item.id}`)), [items, libraryKeys]);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Glass style={styles.backButton}>
            <Feather name="arrow-left" size={16} color={colors.text} />
          </Glass>
        </Pressable>
        <Text variant="title" style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          onEndReached={hasNextPage ? fetchNextPage : undefined}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => <GridCard item={item} showTitle={showItemTitles} />}
          ListFooterComponent={
            hasNextPage ? (
              <Pressable onPress={fetchNextPage} disabled={isFetchingNextPage}>
                <Glass style={[styles.loadMoreButton, isFetchingNextPage && styles.loadMoreButtonDisabled]}>
                  <Text style={styles.loadMoreText}>{t("explore.discover.loadMore")}</Text>
                </Glass>
              </Pressable>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

function GridCard({ item, showTitle }: { item: DiscoverItem; showTitle: boolean }) {
  const router = useRouter();
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");

  function handlePress() {
    if (item.mediaType === "series") {
      router.push(`/series/${item.id}`);
      return;
    }
    router.push(`/movies/${item.id}`);
  }

  return (
    <PressableScale style={styles.card} onPress={handlePress}>
      <Glass style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={20} color={colors.muted} />
          </View>
        )}
        <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} initialStatus={null} />
      </Glass>
      {showTitle && (
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.title}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24) em
  // `header`/`grid`/`skeletonGrid`; web usa `px-4` (`spacing.md`=16)
  // como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.xl,
  },
  grid: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: GRID_GAP,
  },
  row: {
    gap: GRID_GAP,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    gap: GRID_GAP,
  },
  skeletonCard: {
    flexBasis: `${100 / NUM_COLUMNS}%`,
    flexGrow: 0,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  card: {
    flex: 1,
  },
  posterWrapper: {
    position: "relative",
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
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
  cardTitle: {
    marginTop: 6,
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.text,
  },
  loadMoreButton: {
    marginTop: spacing.md,
    alignSelf: "center",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadMoreButtonDisabled: {
    opacity: 0.6,
  },
  loadMoreText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
