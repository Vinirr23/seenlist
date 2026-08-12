import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";

const SITE_URL = "https://seenlist.app";

interface MovieStatusRow {
  movie_id: number;
  status: "watched" | "want_to_watch" | "watching";
  created_at: string;
  updated_at: string;
}

interface SeriesStatusRow {
  series_id: number;
  status: LibraryStatus | "removed";
  created_at: string;
  updated_at: string;
  total_watch_events: number | null;
}

export interface MediaSummary {
  id: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  totalEpisodes?: number;
  ended?: boolean;
  runtimeMinutes?: number;
  /** Só filme (TASK-148). A API já devolve isso — só não estava sendo lido do lado nativo. */
  releaseDate?: string | null;
}

interface LibrarySummariesResponse {
  movies: MediaSummary[];
  series: MediaSummary[];
}


/**
 * TASK-144 (correção — "0/24 episódios" mesmo já tendo assistido
 * vários) — mesma causa raiz já encontrada e corrigida em
 * `recalculateUpToDateSeriesCategories` (seriesDetails.ts): buscar
 * TODOS os episódios assistidos do usuário numa consulta só, sem
 * paginação, esbarra no limite padrão de 1000 linhas do Supabase pra
 * contas com muito histórico — episódios "depois" desse limite na
 * resposta simplesmente não vinham, contando como 0 pras séries
 * afetadas.
 */
/**
 * TASK-144/149 (correção — "0/24 episódios" + lentidão de ~15s pra
 * carregar) — a correção original buscava página por página, cada
 * uma esperando a anterior terminar (`while` sequencial com `await`
 * dentro) — pra contas com muito histórico assistido, isso virava
 * várias idas e voltas ao banco, uma atrás da outra, somando o tempo
 * de rede de cada uma. Agora busca a CONTAGEM primeiro (uma consulta
 * rápida, sem trazer linha nenhuma) e dispara todas as páginas
 * necessárias AO MESMO TEMPO (`Promise.all`) — o tempo de rede das
 * páginas se sobrepõe, em vez de somar.
 */
export interface WatchedEpisodeStats {
  series_id: number;
  watched_count: number;
  last_watched_at: string;
}

/**
 * ACHADO DE PERFORMANCE (a pedido — mesmo achado #2 já corrigido no
 * web) — `fetchAllWatchedEpisodeRows` (linha-por-linha, paginada) baixava CADA linha individual de
 * `watched_episodes`, paginada, só pra usar duas coisas por série:
 * contagem e data do mais recente. Agora chama `get_watched_episode_stats`
 * (RPC já criada no Supabase pra corrigir o mesmo problema no web —
 * mesmo banco dos dois apps, nenhuma migration nova precisa) — o
 * Postgres já devolve uma linha por série, com a soma pronta.
 */
export async function fetchWatchedEpisodeStats(userId: string): Promise<WatchedEpisodeStats[]> {
  const { data, error } = await supabase.rpc("get_watched_episode_stats", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as WatchedEpisodeStats[];
}

function toLibraryStatus(movieStatus: MovieStatusRow["status"]): LibraryStatus {
  return movieStatus === "watched" ? "completed" : movieStatus;
}

/**
 * TASK-093 (correção) — a rota `/api/tmdb/library-summaries` tem um
 * teto de 100 ids por chamada (`MAX_IDS_PER_REQUEST`, no arquivo
 * route.ts do web). A primeira versão desta função mandava tudo de
 * uma vez só — funcionava bem pra bibliotecas pequenas, mas qualquer
 * id além do 100º (na ordem que fosse) nunca era sequer pedido, e
 * silenciosamente caía no fallback `Filme #123`/`Série #123`. Uma
 * biblioteca grande (ex.: importada do TV Time) estoura isso fácil.
 * Mesma correção que o web já tinha (`library-state.ts`): quebra em
 * páginas de 100, busca todas em paralelo, junta o resultado.
 */
const LIBRARY_SUMMARIES_PAGE_SIZE = 100;

function chunkIds(ids: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let start = 0; start < ids.length; start += size) {
    chunks.push(ids.slice(start, start + size));
  }
  return chunks;
}

async function fetchOneLibrarySummariesPage(movieIds: number[], seriesIds: number[]): Promise<LibrarySummariesResponse> {
  if (movieIds.length === 0 && seriesIds.length === 0) {
    return { movies: [], series: [] };
  }
  try {
    const response = await fetch(`${SITE_URL}/api/tmdb/library-summaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds, seriesIds }),
    });
    if (!response.ok) {
      console.warn(`[library] /api/tmdb/library-summaries respondeu ${response.status} numa página — itens desta página ficam sem poster/título.`);
      return { movies: [], series: [] };
    }
    return (await response.json()) as LibrarySummariesResponse;
  } catch (error) {
    console.warn("[library] Falha ao buscar uma página de resumos do TMDB — itens desta página ficam sem poster/título.", error);
    return { movies: [], series: [] };
  }
}

export async function fetchDisplaySummaries(
  movieIds: number[],
  seriesIds: number[]
): Promise<{ movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }> {
  if (movieIds.length === 0 && seriesIds.length === 0) {
    return { movies: {}, series: {} };
  }

  const movieChunks = chunkIds(movieIds, LIBRARY_SUMMARIES_PAGE_SIZE);
  const seriesChunks = chunkIds(seriesIds, LIBRARY_SUMMARIES_PAGE_SIZE);
  const pageCount = Math.max(movieChunks.length, seriesChunks.length, 1);

  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => fetchOneLibrarySummariesPage(movieChunks[index] ?? [], seriesChunks[index] ?? []))
  );

  const movies: MediaSummary[] = [];
  const series: MediaSummary[] = [];
  for (const page of pages) {
    movies.push(...page.movies);
    series.push(...page.series);
  }

  return {
    movies: Object.fromEntries(movies.map((item) => [item.id, item])),
    series: Object.fromEntries(series.map((item) => [item.id, item])),
  };
}

/**
 * ACHADO DE PERFORMANCE (a pedido — mesmo achado #3 já corrigido no
 * Perfil do web, "esquece tudo ao trocar de tela") — o carrossel do
 * Perfil (`ProfileMediaCarousel.tsx`) buscava pôster/título com
 * `useEffect` + estado local puro: sair do Perfil e voltar
 * esquecia tudo, buscando os mesmos pôsteres de novo do zero.
 *
 * O mobile não usa React Query (decisão arquitetural do projeto,
 * mesmo padrão de `useMyLists.ts`) — em vez de um cache de
 * biblioteca externa, um cache simples em memória, no MÓDULO (não
 * no componente): sobrevive a montar/desmontar a tela, só se perde
 * se o app fechar de vez. 5 minutos de validade — mesma janela já
 * usada no resto do app pra resumo do TMDB.
 */
const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000;
const summaryCache = new Map<string, { data: MediaSummary; expiresAt: number }>();

export async function fetchDisplaySummariesCached(
  movieIds: number[],
  seriesIds: number[]
): Promise<{ movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }> {
  const now = Date.now();
  const movies: Record<number, MediaSummary> = {};
  const series: Record<number, MediaSummary> = {};
  const missingMovieIds: number[] = [];
  const missingSeriesIds: number[] = [];

  for (const id of movieIds) {
    const cached = summaryCache.get(`movie:${id}`);
    if (cached && cached.expiresAt > now) {
      movies[id] = cached.data;
    } else {
      missingMovieIds.push(id);
    }
  }
  for (const id of seriesIds) {
    const cached = summaryCache.get(`series:${id}`);
    if (cached && cached.expiresAt > now) {
      series[id] = cached.data;
    } else {
      missingSeriesIds.push(id);
    }
  }

  if (missingMovieIds.length > 0 || missingSeriesIds.length > 0) {
    const fetched = await fetchDisplaySummaries(missingMovieIds, missingSeriesIds);
    const expiresAt = Date.now() + SUMMARY_CACHE_TTL_MS;
    for (const [id, summary] of Object.entries(fetched.movies)) {
      summaryCache.set(`movie:${id}`, { data: summary, expiresAt });
      movies[Number(id)] = summary;
    }
    for (const [id, summary] of Object.entries(fetched.series)) {
      summaryCache.set(`series:${id}`, { data: summary, expiresAt });
      series[Number(id)] = summary;
    }
  }

  return { movies, series };
}

/** Idêntico a `buildLibraryItemsFromRows` do web (lib/queries/library-state.ts) — mesma regra, sem alteração, só copiada pro lado nativo (os apps não importam código um do outro neste monorepo). */
function buildLibraryItemsFromRows(
  movieRows: MovieStatusRow[],
  seriesRows: SeriesStatusRow[],
  episodeStats: WatchedEpisodeStats[],
  summaries: { movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }
): LibraryItem[] {
  const episodeAgg = new Map<number, { count: number; lastWatchedAt: string }>();
  for (const stat of episodeStats) {
    episodeAgg.set(stat.series_id, { count: stat.watched_count, lastWatchedAt: stat.last_watched_at });
  }

  const explicitSeriesById = new Map(seriesRows.map((row) => [row.series_id, row]));

  const seriesIds = new Set<number>([
    ...seriesRows.filter((row) => row.status !== "removed").map((row) => row.series_id),
    ...episodeAgg.keys(),
  ]);
  for (const row of seriesRows) {
    if (row.status === "removed") seriesIds.delete(row.series_id);
  }

  const seriesEntries = [...seriesIds].map((seriesId) => {
    const explicit = explicitSeriesById.get(seriesId);
    const agg = episodeAgg.get(seriesId);
    const watchedCount = agg?.count ?? 0;
    const updatedAt = explicit?.updated_at ?? agg?.lastWatchedAt ?? new Date(0).toISOString();

    return {
      seriesId,
      status: (explicit && explicit.status !== "removed" ? explicit.status : "watching") as LibraryStatus,
      isDerived: !explicit,
      createdAt: explicit?.created_at ?? agg?.lastWatchedAt ?? new Date(0).toISOString(),
      updatedAt,
      // Maior entre "categoria mudou" e "episódio marcado" — mesma
      // correção já aplicada no web (lib/queries/library-state.ts).
      lastActivityAt: agg?.lastWatchedAt && agg.lastWatchedAt > updatedAt ? agg.lastWatchedAt : updatedAt,
      watchedCount,
      totalWatchEvents: explicit?.total_watch_events ?? null,
    };
  });

  const movieEntries = movieRows.map((row) => ({
    movieId: row.movie_id,
    status: toLibraryStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const movieItems: LibraryItem[] = movieEntries.map((entry) => {
    const summary = summaries.movies[entry.movieId];
    return {
      mediaType: "movie",
      id: entry.movieId,
      status: entry.status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lastActivityAt: entry.updatedAt,
      title: summary?.title ?? `Filme #${entry.movieId}`,
      year: summary?.year ?? null,
      posterPath: summary?.posterPath ?? null,
      runtimeMinutes: summary?.runtimeMinutes,
      releaseDate: summary?.releaseDate ?? null,
    };
  });

  const seriesItems: LibraryItem[] = seriesEntries.map((entry) => {
    const summary = summaries.series[entry.seriesId];
    const totalEpisodes = summary?.totalEpisodes ?? 0;
    const status: LibraryStatus = entry.isDerived ? "watching" : entry.status;

    return {
      mediaType: "series",
      id: entry.seriesId,
      status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      lastActivityAt: entry.lastActivityAt,
      title: summary?.title ?? `Série #${entry.seriesId}`,
      year: summary?.year ?? null,
      posterPath: summary?.posterPath ?? null,
      progress: {
        watchedEpisodes: entry.watchedCount,
        totalEpisodes,
        totalWatchEvents: entry.totalWatchEvents ?? undefined,
      },
      runtimeMinutes: summary?.runtimeMinutes,
    };
  });

  return [...movieItems, ...seriesItems];
}

/**
 * O ESTADO da Biblioteca vem inteiramente das 3 tabelas (RLS filtra
 * por conta própria quando `userId` não é passado; quando é, o
 * chamador É o visitante olhando a biblioteca de outra pessoa — a
 * RLS de visibilidade pública decide o que aparece, não este código;
 * ver `fetchPublicLibraryItems` em `lib/publicProfile.ts`); o TMDB só
 * decora depois com poster/título — mesma ordem de responsabilidades
 * do web.
 */
export async function fetchLibraryItems(userId?: string): Promise<LibraryItem[]> {
  let targetUserId = userId;
  if (!targetUserId) {
    const {
      data: { user },
    } = await getCurrentAuthUser();
    if (!user) return [];
    targetUserId = user.id;
  }

  /*
   * A PEDIDO — auditoria a fundo, mesmo padrão de bug já confirmado
   * em `check-new-releases` (Supabase corta em 1000 linhas por
   * padrão) e corrigido no web (`library-state.ts`, mesma consulta
   * exata). Sem confirmação de que algum usuário já passou de 1000
   * séries acompanhadas, mas o mesmo risco existe — corrigido por
   * precaução, mesmo padrão de paginação.
   */
  const { count: seriesStatusCount } = await supabase
    .from("series_status")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", targetUserId);
  const SERIES_STATUS_PAGE_SIZE = 1000;
  const seriesStatusPages = await Promise.all(
    Array.from({ length: Math.ceil((seriesStatusCount ?? 0) / SERIES_STATUS_PAGE_SIZE) }, (_, i) =>
      supabase
        .from("series_status")
        .select("series_id, status, created_at, updated_at, total_watch_events")
        .eq("user_id", targetUserId)
        .range(i * SERIES_STATUS_PAGE_SIZE, i * SERIES_STATUS_PAGE_SIZE + SERIES_STATUS_PAGE_SIZE - 1)
    )
  );
  const seriesStatusError = seriesStatusPages.find((p) => p.error)?.error;
  const seriesStatusData = seriesStatusPages.flatMap((p) => p.data ?? []);

  const [movieResult, episodeStats] = await Promise.all([
    supabase.from("movie_status").select("movie_id, status, created_at, updated_at").eq("user_id", targetUserId),
    fetchWatchedEpisodeStats(targetUserId),
  ]);
  const seriesResult = { data: seriesStatusData, error: seriesStatusError };

  if (movieResult.error) throw movieResult.error;
  if (seriesResult.error) throw seriesResult.error;

  const movieRows = (movieResult.data ?? []) as MovieStatusRow[];
  const seriesRows = (seriesResult.data ?? []) as SeriesStatusRow[];

  const validSeriesIds = new Set<number>([
    ...seriesRows.filter((row) => row.status !== "removed").map((row) => row.series_id),
    ...episodeStats.map((stat) => stat.series_id),
  ]);
  for (const row of seriesRows) {
    if (row.status === "removed") validSeriesIds.delete(row.series_id);
  }

  const summaries = await fetchDisplaySummaries(
    movieRows.map((row) => row.movie_id),
    [...validSeriesIds]
  );

  return buildLibraryItemsFromRows(movieRows, seriesRows, episodeStats, summaries);
}

/** URL de pôster do TMDB — mesma função do web (lib/tmdb/image.ts), só copiada. */
export function tmdbImageUrl(path: string | null, size: "w185" | "w342" | "w780" = "w342"): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
