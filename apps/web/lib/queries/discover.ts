import { useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import type { DiscoverItem, SimilarSource } from "@/lib/tmdb/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useLibraryItems } from "@/lib/queries/library";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export type DiscoverListKey =
  | "trending_series"
  | "trending_movies"
  | "popular_series"
  | "popular_movies"
  | "upcoming_movies"
  | "on_the_air_series";

interface DiscoverListResponse {
  items: DiscoverItem[];
  genreMap: Record<number, string> | null;
}

async function fetchDiscoverList(list: DiscoverListKey, withGenres: boolean, language: string): Promise<DiscoverListResponse> {
  const response = await fetch(`/api/tmdb/explore?list=${list}${withGenres ? "&genres=1" : ""}&language=${language}`);
  if (!response.ok) throw new Error("discover fetch failed");
  return response.json();
}

/**
 * TASK-058 — uma lista de descoberta (trending, popular, etc). Cache
 * de 5 min, mesmo padrão de staleTime já usado por upcoming-episodes
 * e outras consultas TMDB do projeto.
 *
 * CORREÇÃO (bug real, reportado — "capas em Explorar continuam em
 * português mesmo com inglês selecionado") — nunca repassava o
 * idioma pra rota, mesmo ela já aceitando `?language=` desde a
 * correção de idioma do TMDB. Mesmo bug já corrigido no mobile
 * (`useDiscoverList.ts`), só que esse arquivo do web tinha ficado de
 * fora daquela rodada.
 */
export function useDiscoverList(list: DiscoverListKey, withGenres = false) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["discover-list", list, withGenres, locale],
    queryFn: () => fetchDiscoverList(list, withGenres, locale),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

// A PEDIDO — paginação nas telas "ver todos" (2026-08-22). `page`/
// `totalPages` vêm de `/api/tmdb/explore` (repassados de
// `DiscoverPage`/`SimilarDiscoverPage` em `lib/tmdb/client.ts`).
interface PaginatedDiscoverResponse extends DiscoverListResponse {
  page: number;
  totalPages: number;
}

async function fetchDiscoverListPage(list: DiscoverListKey, page: number, language: string): Promise<PaginatedDiscoverResponse> {
  // Sem `genres=1` — diferente de `useDiscoverList` acima, esta versão
  // só alimenta `DiscoverAllView.tsx`, que nunca mostra nome de
  // gênero nos cards (só pôster/título) — pedir o mapa aqui seria uma
  // chamada extra a mais sem consumidor nenhum.
  const response = await fetch(`/api/tmdb/explore?list=${list}&language=${language}&page=${page}`);
  if (!response.ok) throw new Error("discover fetch failed");
  return response.json();
}

/**
 * Versão paginada de `useDiscoverList`, só pras telas "ver todos"
 * (`DiscoverAllView.tsx`) — os carrosséis da tela principal continuam
 * usando `useDiscoverList` acima, sem mudança nenhuma (pergunta feita
 * ao usuário, AskUserQuestion: paginação só nas telas de grade).
 * `data.pages` vem como uma lista de páginas separadas (padrão do
 * React Query) — quem usa este hook precisa achatar com
 * `flattenDiscoverPages` abaixo antes de renderizar.
 */
export function useDiscoverListInfinite(list: DiscoverListKey) {
  const { locale } = useTranslation();
  return useInfiniteQuery({
    queryKey: ["discover-list-infinite", list, locale],
    queryFn: ({ pageParam }) => fetchDiscoverListPage(list, pageParam, locale),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

// Fase C da reformulação da Explorar (2026-08-21) — lista de
// descoberta filtrada por gênero (`/discover/movie`/`/discover/tv`
// via `?genreId=`), diferente das listas fixas de `DiscoverListKey`
// acima (que não recebem parâmetro nenhum).
export type GenreDiscoverKey = "genre_movies" | "genre_series";

async function fetchGenreDiscoverList(kind: GenreDiscoverKey, genreId: number, language: string): Promise<DiscoverListResponse> {
  const response = await fetch(`/api/tmdb/explore?list=${kind}&genreId=${genreId}&language=${language}`);
  if (!response.ok) throw new Error("genre discover fetch failed");
  return response.json();
}

/**
 * `genreId: null` significa "ainda não sei o gênero favorito" (ex.:
 * `useFavoriteGenres` ainda carregando, ou usuário sem itens
 * concluídos) — `enabled: false` evita disparar a busca à toa.
 */
export function useDiscoverByGenre(kind: GenreDiscoverKey, genreId: number | null) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["discover-by-genre", kind, genreId, locale],
    queryFn: () => fetchGenreDiscoverList(kind, genreId as number, locale),
    enabled: genreId != null,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

async function fetchGenreDiscoverListPage(kind: GenreDiscoverKey, genreId: number, page: number, language: string): Promise<PaginatedDiscoverResponse> {
  const response = await fetch(`/api/tmdb/explore?list=${kind}&genreId=${genreId}&language=${language}&page=${page}`);
  if (!response.ok) throw new Error("genre discover fetch failed");
  return response.json();
}

/**
 * Versão paginada de `useDiscoverByGenre`, só pra tela "ver todos"
 * de um gênero (`GenreAllView.tsx`) — mesmo raciocínio de
 * `useDiscoverListInfinite` acima.
 */
export function useDiscoverByGenreInfinite(kind: GenreDiscoverKey, genreId: number | null) {
  const { locale } = useTranslation();
  return useInfiniteQuery({
    queryKey: ["discover-by-genre-infinite", kind, genreId, locale],
    queryFn: ({ pageParam }) => fetchGenreDiscoverListPage(kind, genreId as number, pageParam, locale),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    enabled: genreId != null,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

// Fase D da reformulação da Explorar (2026-08-22) — "Porque você
// assistiu a [X]": lista de descoberta baseada num TÍTULO-ÂNCORA
// (recomendações/similares do TMDB pra 1 filme/série específico da
// Biblioteca do usuário, ver `useAnchorTitle` em `anchor-title.ts`),
// diferente de `GenreDiscoverKey` acima (que filtra por gênero, não
// por título). Mesmo formato de resposta (`DiscoverListResponse`),
// então reaproveita `DiscoverCarousel` sem mudança nenhuma.
export type SimilarDiscoverKey = "similar_movies" | "similar_series";

async function fetchSimilarDiscoverList(kind: SimilarDiscoverKey, anchorId: number, language: string): Promise<DiscoverListResponse> {
  const response = await fetch(`/api/tmdb/explore?list=${kind}&anchorId=${anchorId}&language=${language}`);
  if (!response.ok) throw new Error("similar discover fetch failed");
  return response.json();
}

/**
 * `anchorId: null` significa "ainda não sei o título-âncora" (ex.:
 * `useAnchorTitle` ainda carregando, ou usuário sem item
 * concluído/em dia daquele tipo) — `enabled: false` evita disparar a
 * busca à toa, mesmo padrão de `useDiscoverByGenre` acima.
 */
export function useDiscoverSimilar(kind: SimilarDiscoverKey, anchorId: number | null) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["discover-similar", kind, anchorId, locale],
    queryFn: () => fetchSimilarDiscoverList(kind, anchorId as number, locale),
    enabled: anchorId != null,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

interface PaginatedSimilarResponse extends PaginatedDiscoverResponse {
  source: SimilarSource;
}

async function fetchSimilarDiscoverListPage(
  kind: SimilarDiscoverKey,
  anchorId: number,
  page: number,
  source: SimilarSource | undefined,
  language: string
): Promise<PaginatedSimilarResponse> {
  const sourceParam = source ? `&source=${source}` : "";
  const response = await fetch(`/api/tmdb/explore?list=${kind}&anchorId=${anchorId}&language=${language}&page=${page}${sourceParam}`);
  if (!response.ok) throw new Error("similar discover fetch failed");
  return response.json();
}

/**
 * Versão paginada de `useDiscoverSimilar`, só pra tela "ver todos"
 * (`SimilarAllView.tsx`) — mesmo raciocínio de `useDiscoverListInfinite`.
 *
 * IMPORTANTE — diferente das outras duas versões paginadas acima, o
 * "próximo parâmetro de página" aqui não é só um número: é
 * `{page, source}`. `source` (recommendations vs. similar) só é
 * decidido pelo servidor na página 1 — a partir da página 2, esta
 * lista precisa continuar mandando de volta o MESMO `source` que a
 * página 1 devolveu (ver comentário longo em `getSimilarMoviesForId`,
 * `lib/tmdb/client.ts`), senão a origem dos dados poderia mudar no
 * meio da rolagem sem ninguém perceber.
 */
export function useDiscoverSimilarInfinite(kind: SimilarDiscoverKey, anchorId: number | null) {
  const { locale } = useTranslation();
  return useInfiniteQuery({
    queryKey: ["discover-similar-infinite", kind, anchorId, locale],
    queryFn: ({ pageParam }) => fetchSimilarDiscoverListPage(kind, anchorId as number, pageParam.page, pageParam.source, locale),
    initialPageParam: { page: 1, source: undefined as SimilarSource | undefined },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? { page: lastPage.page + 1, source: lastPage.source } : undefined,
    enabled: anchorId != null,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

export function genreNames(item: DiscoverItem, genreMap: Record<number, string> | null | undefined): string[] {
  if (!genreMap) return [];
  return item.genreIds.map((id) => genreMap[id]).filter((name): name is string => Boolean(name));
}

/**
 * Achata `data.pages` (formato padrão do `useInfiniteQuery` — uma
 * página por busca) numa lista única de itens, na ordem certa —
 * usado pelas 3 telas "ver todos" (`DiscoverAllView`/`GenreAllView`/
 * `SimilarAllView`) antes de renderizar a grade.
 */
export function flattenDiscoverPages(pages: { items: DiscoverItem[] }[] | undefined): DiscoverItem[] {
  return (pages ?? []).flatMap((p) => p.items);
}

/**
 * Movido de `ExploreDiscoverTab.tsx` (reformulação da aba Explorar,
 * 2026-08-21 — abas Filmes/Séries separadas substituem a antiga aba
 * única "Descobrir") — antes vivia só naquele arquivo; agora
 * `ExploreSeriesTab.tsx` e `ExploreMoviesTab.tsx` usam os dois,
 * então virou uma função compartilhada aqui. Comportamento idêntico:
 * filtra fora qualquer título que já esteja na Biblioteca do usuário.
 */
export function useFilterOutLibraryItems(items: DiscoverItem[] | undefined): DiscoverItem[] {
  const { data: libraryItems } = useLibraryItems();

  const libraryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of libraryItems ?? []) {
      keys.add(`${item.mediaType}:${item.id}`);
    }
    return keys;
  }, [libraryItems]);

  return useMemo(() => (items ?? []).filter((item) => !libraryKeys.has(`${item.mediaType}:${item.id}`)), [items, libraryKeys]);
}
