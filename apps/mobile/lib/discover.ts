import { supabase, getCurrentAuthUser } from "@/lib/supabase";

const SITE_URL = "https://seenlist.app";

export type DiscoverListKey =
  | "trending_series"
  | "trending_movies"
  | "popular_series"
  | "popular_movies"
  | "upcoming_movies"
  | "on_the_air_series";

export interface DiscoverItem {
  id: number;
  mediaType: "movie" | "series";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  genreIds: number[];
  voteAverage: number;
}

interface DiscoverListResponse {
  items: DiscoverItem[];
  genreMap: Record<number, string> | null;
}

/** Idêntico a lib/queries/discover.ts do web — mesma rota (/api/tmdb/explore, já liberada no middleware pro app nativo). */
export async function fetchDiscoverList(list: DiscoverListKey, language?: string): Promise<DiscoverItem[]> {
  const languageParam = language ? `&language=${encodeURIComponent(language)}` : "";
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${list}${languageParam}`);
  if (!response.ok) throw new Error("discover fetch failed");
  const data = (await response.json()) as DiscoverListResponse;
  return data.items;
}

/**
 * PORTE DO WEB (2026-09-02 — "vamos implementar as mudanças que
 * foram feitas no web", reformulação completa da Explorar) — as duas
 * seções abaixo (`GenreDiscoverKey`/`SimilarDiscoverKey`) são idênticas
 * a `lib/queries/discover.ts` do web: mesma rota `/api/tmdb/explore`
 * (já liberada pro app nativo, mesma que `fetchDiscoverList` acima já
 * usa), só com `genreId`/`anchorId` a mais na query string. Nenhuma
 * rota nova no backend — só as duas funções que faltavam aqui pro
 * lado mobile também poder pedir "descobrir por gênero"/"parecido com
 * X", que antes só o web usava.
 */
export type GenreDiscoverKey = "genre_movies" | "genre_series";

export async function fetchGenreDiscoverList(kind: GenreDiscoverKey, genreId: number, language?: string): Promise<DiscoverItem[]> {
  const languageParam = language ? `&language=${encodeURIComponent(language)}` : "";
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${kind}&genreId=${genreId}${languageParam}`);
  if (!response.ok) throw new Error("genre discover fetch failed");
  const data = (await response.json()) as DiscoverListResponse;
  return data.items;
}

export type SimilarDiscoverKey = "similar_movies" | "similar_series";

export async function fetchSimilarDiscoverList(kind: SimilarDiscoverKey, anchorId: number, language?: string): Promise<DiscoverItem[]> {
  const languageParam = language ? `&language=${encodeURIComponent(language)}` : "";
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${kind}&anchorId=${anchorId}${languageParam}`);
  if (!response.ok) throw new Error("similar discover fetch failed");
  const data = (await response.json()) as DiscoverListResponse;
  return data.items;
}

/**
 * PORTE DO WEB (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile") — versões PAGINADAS
 * das 3 buscas acima, idênticas em espírito a `lib/queries/discover.ts`
 * do web (`fetchDiscoverListPage`/`fetchGenreDiscoverListPage`/
 * `fetchSimilarDiscoverListPage`): a mesma rota `/api/tmdb/explore` já
 * aceita `?page=N` e devolve `page`/`totalPages` junto de `items` (ver
 * `route.ts`) — só faltava o lado mobile pedir isso e usar. Usadas
 * pelas telas novas "ver todos" (`app/explore/all/[list].tsx`,
 * `app/explore/genre/[mediaType]/[genreId].tsx`,
 * `app/explore/similar/[mediaType]/[anchorId].tsx`), abertas pela seta
 * que os carrosséis do Explorar agora têm (`DiscoverCarousel.tsx`,
 * prop `viewAllHref`). Os carrosséis da tela principal (`ExploreMoviesTab`/
 * `ExploreSeriesTab`) continuam usando as versões SEM paginação acima,
 * sem mudança nenhuma — mesma decisão já tomada no web (paginação só
 * nas telas de grade "ver todos").
 */
export interface PaginatedDiscoverResponse extends DiscoverListResponse {
  page: number;
  totalPages: number;
}

export async function fetchDiscoverListPage(list: DiscoverListKey, page: number, language?: string): Promise<PaginatedDiscoverResponse> {
  const languageParam = language ? `&language=${encodeURIComponent(language)}` : "";
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${list}&page=${page}${languageParam}`);
  if (!response.ok) throw new Error("discover page fetch failed");
  return response.json();
}

export async function fetchGenreDiscoverListPage(
  kind: GenreDiscoverKey,
  genreId: number,
  page: number,
  language?: string
): Promise<PaginatedDiscoverResponse> {
  const languageParam = language ? `&language=${encodeURIComponent(language)}` : "";
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${kind}&genreId=${genreId}&page=${page}${languageParam}`);
  if (!response.ok) throw new Error("genre discover page fetch failed");
  return response.json();
}

/**
 * `source` ("recommendations" vs "similar") — só o SERVIDOR decide na
 * página 1 (ver `getSimilarMoviesForId`/`getSimilarSeriesForId`, web,
 * pro racional completo: usa recomendações do TMDB por padrão, cai
 * pra "títulos parecidos" só se recomendações vier vazio). A partir da
 * página 2, PRECISA mandar de volta o MESMO `source` que a página 1
 * devolveu (por isso o parâmetro aqui, repassado como `?source=` só
 * quando já se sabe qual é) — senão a origem dos dados poderia trocar
 * no meio da rolagem sem ninguém perceber, mesmo bug que o web evitou
 * com o mesmo cuidado.
 */
export type SimilarSource = "recommendations" | "similar";

export interface PaginatedSimilarResponse extends PaginatedDiscoverResponse {
  source: SimilarSource;
}

export async function fetchSimilarDiscoverListPage(
  kind: SimilarDiscoverKey,
  anchorId: number,
  page: number,
  source: SimilarSource | undefined,
  language?: string
): Promise<PaginatedSimilarResponse> {
  const languageParam = language ? `&language=${encodeURIComponent(language)}` : "";
  const sourceParam = source ? `&source=${source}` : "";
  const response = await fetch(`${SITE_URL}/api/tmdb/explore?list=${kind}&anchorId=${anchorId}&page=${page}${languageParam}${sourceParam}`);
  if (!response.ok) throw new Error("similar discover page fetch failed");
  return response.json();
}

/**
 * TASK-152 (correção — botão "+" aparecendo com atraso, depois do
 * pôster) — antes, cada `AddToLibraryButton` buscava seu próprio
 * status individualmente (uma consulta por pôster visível na tela) —
 * com vários pôsteres, isso virava várias buscas soltas, cada uma
 * com seu próprio atraso, fazendo o botão "aparecer depois" do
 * pôster. Busca TODOS de uma vez (2 consultas no total, uma por
 * tabela, não uma por item) — quem chama (o carrossel) já tem a
 * resposta pronta antes de desenhar qualquer botão.
 */
export async function fetchLibraryStatusesFor(items: { mediaType: "movie" | "series"; id: number }[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return result;

  const movieIds = items.filter((i) => i.mediaType === "movie").map((i) => i.id);
  const seriesIds = items.filter((i) => i.mediaType === "series").map((i) => i.id);

  const [movieResult, seriesResult] = await Promise.all([
    movieIds.length > 0
      ? supabase.from("movie_status").select("movie_id, status").eq("user_id", user.id).in("movie_id", movieIds)
      : Promise.resolve({ data: [], error: null }),
    seriesIds.length > 0
      ? supabase.from("series_status").select("series_id, status").eq("user_id", user.id).in("series_id", seriesIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const row of movieResult.data ?? []) result.set(`movie-${row.movie_id}`, row.status);
  for (const row of seriesResult.data ?? []) result.set(`series-${row.series_id}`, row.status);
  return result;
}
