import { useQuery } from "@tanstack/react-query";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import type { MediaSummary } from "@/lib/tmdb/client";
import { useRealtimeInvalidate } from "@/lib/supabase/useRealtimeInvalidate";

export const LIBRARY_QUERY_KEY = ["library"] as const;
const LIBRARY_REALTIME_TABLES = ["movie_status", "series_status", "watched_episodes"] as const;

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
  /** TASK-027J — só para estatísticas, nunca para decidir status/progresso (isso continua vindo só de watched_episodes). */
  total_watch_events: number | null;
}

export interface WatchedEpisodeRow {
  series_id: number;
  watched_at: string;
}

interface LibrarySummariesResponse {
  movies: MediaSummary[];
  series: MediaSummary[];
}

/**
 * AUDITORIA — mesmo bug já encontrado e corrigido no mobile
 * (TASK-144/149, `WATCHED_EPISODES_PAGE_SIZE` em `apps/mobile/lib/
 * library.ts`), nunca portado pro web: sem paginação, o limite
 * padrão de 1000 linhas por consulta do Supabase/PostgREST cortava
 * silenciosamente a contagem de episódios assistidos pra contas com
 * muito histórico. Busca a CONTAGEM primeiro (rápida, sem trazer
 * linha nenhuma) e dispara todas as páginas necessárias ao mesmo
 * tempo (`Promise.all`) — mesmo raciocínio de `fetchDisplaySummaries`
 * logo acima. Reaproveitada por `fetchLibraryItems` (biblioteca
 * própria), `usePublicLibraryItems` (biblioteca de outro usuário) e
 * `useProfileSectionCounts` (contador "Séries" do Perfil) — as três
 * tinham a mesma consulta sem paginação, duplicada.
 */
const WATCHED_EPISODES_PAGE_SIZE = 1000;

export async function fetchAllWatchedEpisodeRows(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<WatchedEpisodeRow[]> {
  const { count, error: countError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("is_special", false)
    .eq("user_id", userId);
  if (countError) throw countError;

  const total = count ?? 0;
  if (total === 0) return [];

  const pageCount = Math.ceil(total / WATCHED_EPISODES_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * WATCHED_EPISODES_PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id, watched_at")
        .eq("is_special", false)
        .eq("user_id", userId)
        .range(from, from + WATCHED_EPISODES_PAGE_SIZE - 1);
    })
  );

  const rows: WatchedEpisodeRow[] = [];
  for (const page of pages) {
    if (page.error) throw page.error;
    rows.push(...((page.data ?? []) as WatchedEpisodeRow[]));
  }
  return rows;
}

function toLibraryStatus(movieStatus: MovieStatusRow["status"]): LibraryStatus {
  return movieStatus === "watched" ? "completed" : movieStatus;
}

/**
 * TASK-038 — mesmo valor de MAX_IDS_PER_REQUEST em
 * api/tmdb/library-summaries/route.ts. Não é o mesmo número por
 * coincidência — os dois PRECISAM bater, porque é esse limite que
 * está sendo paginado aqui, não removido. Se um dia um dos dois
 * mudar sem o outro, a paginação para de bater exatamente na borda
 * do lote e pode voltar a cortar silenciosamente.
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
    const response = await fetch("/api/tmdb/library-summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds, seriesIds }),
    });
    if (!response.ok) {
      console.warn(
        `[library] /api/tmdb/library-summaries respondeu ${response.status} numa página — exibindo os itens desta página sem poster/título.`
      );
      return { movies: [], series: [] };
    }
    return (await response.json()) as LibrarySummariesResponse;
  } catch (error) {
    console.warn("[library] Falha ao buscar uma página de resumos do TMDB — exibindo os itens desta página sem poster/título.", error);
    return { movies: [], series: [] };
  }
}

/**
 * TASK-038 — "nunca mais pode existir descarte silencioso". Compara
 * o que foi pedido contra o que voltou e SEMPRE avisa quando os
 * números não batem — mesmo quando a causa for legítima (o TMDB
 * genuinamente não tem aquele id), o aviso aparece; a diferença é só
 * que aqui dá pra saber exatamente quais ids específicos faltaram,
 * em vez de só perceber pela ausência de pôster na tela.
 */
function warnIfAnyIdMissing(label: string, requestedIds: number[], received: MediaSummary[]): void {
  if (requestedIds.length === received.length) return;
  const receivedIds = new Set(received.map((item) => item.id));
  const missingIds = requestedIds.filter((id) => !receivedIds.has(id));
  console.warn(
    `[library] Resumos de ${label}: ${requestedIds.length} ids solicitados, ${received.length} resumos retornados. Ids sem resposta: ${missingIds.join(", ")}`
  );
}

/**
 * TASK-038 — correção da causa raiz comprovada pelo diagnóstico:
 * antes, esta função mandava TODOS os ids numa chamada só, e a rota
 * cortava silenciosamente pros primeiros 100 (MAX_IDS_PER_REQUEST).
 * Agora ela mesma pagina — quebra em grupos de até 100, chama a
 * rota uma vez por grupo (em paralelo — as 100 requisições
 * individuais dentro de cada página já tinham 100% de sucesso no
 * diagnóstico, nada indica que rodar várias páginas ao mesmo tempo
 * cause problema), e junta tudo antes de devolver. A Biblioteca
 * continua chamando isto uma vez só — a paginação é só daqui pra
 * dentro, nada muda pra quem chama.
 */
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
    Array.from({ length: pageCount }, (_, index) =>
      fetchOneLibrarySummariesPage(movieChunks[index] ?? [], seriesChunks[index] ?? [])
    )
  );

  const movies: MediaSummary[] = [];
  const series: MediaSummary[] = [];
  for (const page of pages) {
    movies.push(...page.movies);
    series.push(...page.series);
  }

  warnIfAnyIdMissing("filmes", movieIds, movies);
  warnIfAnyIdMissing("séries", seriesIds, series);

  return {
    movies: Object.fromEntries(movies.map((item) => [item.id, item])),
    series: Object.fromEntries(series.map((item) => [item.id, item])),
  };
}

/**
 * O ESTADO da biblioteca (o que está em cada aba, status, progresso
 * assistido) vem inteiramente daqui — três tabelas do Supabase, do
 * usuário logado (RLS cuida disso, não precisamos filtrar por
 * user_id nas queries). O TMDB só entra depois, pra decorar o que já
 * foi decidido aqui com poster/título/ano ("apenas para exibição").
 */
/**
 * Extraído de dentro de `fetchLibraryItems` pra ser reaproveitado
 * também pela biblioteca pública de outro usuário (TASK-028) — a
 * consulta em si muda (filtra por um `user_id` específico em vez de
 * confiar só no RLS pro usuário atual), mas a lógica de "como
 * transformar as 3 tabelas cruas num LibraryItem[]" é exatamente a
 * mesma, então mora num lugar só.
 */
export function buildLibraryItemsFromRows(
  movieRows: MovieStatusRow[],
  seriesRows: SeriesStatusRow[],
  episodeRows: WatchedEpisodeRow[],
  summaries: { movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }
): LibraryItem[] {
  // Agrega episódios assistidos por série (contagem + data do mais recente).
  const episodeAgg = new Map<number, { count: number; lastWatchedAt: string }>();
  for (const row of episodeRows) {
    const entry = episodeAgg.get(row.series_id);
    if (!entry) {
      episodeAgg.set(row.series_id, { count: 1, lastWatchedAt: row.watched_at });
    } else {
      entry.count += 1;
      if (row.watched_at > entry.lastWatchedAt) entry.lastWatchedAt = row.watched_at;
    }
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

    return {
      seriesId,
      status: (explicit && explicit.status !== "removed" ? explicit.status : "watching") as LibraryStatus,
      isDerived: !explicit,
      createdAt: explicit?.created_at ?? agg?.lastWatchedAt ?? new Date(0).toISOString(),
      updatedAt: explicit?.updated_at ?? agg?.lastWatchedAt ?? new Date(0).toISOString(),
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
      title: summary?.title ?? `Filme #${entry.movieId}`,
      year: summary?.year ?? null,
      posterPath: summary?.posterPath ?? null,
      runtimeMinutes: summary?.runtimeMinutes,
    };
  });

  const seriesItems: LibraryItem[] = seriesEntries.map((entry) => {
    const summary = summaries.series[entry.seriesId];
    const totalEpisodes = summary?.totalEpisodes ?? 0;

    // TASK-033 — status já vem definitivo do banco (o importador
    // decidiu isso na gravação, com dado ao vivo do TMDB — ver
    // validateSeriesStatus.ts). Esta leitura não reclassifica mais
    // nada, só usa o que já está salvo. `isDerived` continua sendo
    // o único fallback — série com episódios marcados mas sem linha
    // explícita de status (cenário diferente, não é reclassificação
    // de status existente).
    const status: LibraryStatus = entry.isDerived ? "watching" : entry.status;

    return {
      mediaType: "series",
      id: entry.seriesId,
      status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
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

/** Exportado (só visibilidade, TASK-034) pra ferramentas de comparação chamarem exatamente esta função — não uma reimplementação — garantindo fidelidade 100% com o que a tela real usa. */
export async function fetchLibraryItems(): Promise<LibraryItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return [];

  // CORREÇÃO CRÍTICA — a política de biblioteca pública (leitura
  // "respeita visibilidade") permite ver series_status/movie_status/
  // watched_episodes de OUTROS usuários com perfil público ou
  // seguido. Sem filtro explícito de user_id aqui, a Biblioteca
  // inteira do usuário atual podia se misturar com a de qualquer
  // pessoa cujo perfil ele segue/é público — a causa raiz real por
  // trás de "mesclou" ao reimportar.
  const [movieResult, seriesResult, episodeRows] = await Promise.all([
    supabase.from("movie_status").select("movie_id, status, created_at, updated_at").eq("user_id", user.id),
    supabase
      .from("series_status")
      .select("series_id, status, created_at, updated_at, total_watch_events")
      .eq("user_id", user.id),
    fetchAllWatchedEpisodeRows(supabase, user.id),
  ]);

  if (movieResult.error) {
    console.error("[library] Falha ao buscar movie_status", movieResult.error);
    throw movieResult.error;
  }
  if (seriesResult.error) {
    console.error("[library] Falha ao buscar series_status", seriesResult.error);
    throw seriesResult.error;
  }

  const movieRows = (movieResult.data ?? []) as MovieStatusRow[];
  const seriesRows = (seriesResult.data ?? []) as SeriesStatusRow[];

  // Mesma regra de inclusão que buildLibraryItemsFromRows aplica por
  // dentro — precisa ser calculada aqui de novo porque os resumos do
  // TMDB são buscados ANTES de virar LibraryItem[], e não podem
  // incluir uma série marcada como "removed".
  const validSeriesIds = new Set<number>([
    ...seriesRows.filter((row) => row.status !== "removed").map((row) => row.series_id),
    ...episodeRows.map((row) => row.series_id),
  ]);
  for (const row of seriesRows) {
    if (row.status === "removed") validSeriesIds.delete(row.series_id);
  }

  const summaries = await fetchDisplaySummaries(
    movieRows.map((row) => row.movie_id),
    [...validSeriesIds]
  );

  return buildLibraryItemsFromRows(movieRows, seriesRows, episodeRows, summaries);
}

export function useLibraryItems() {
  return useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: fetchLibraryItems,
  });
}

/**
 * "Atualização em tempo real sempre que o usuário alterar um status"
 * — assina mudanças nas 3 tabelas que compõem a Biblioteca. Desde a
 * conexão do fluxo principal (TASK-009), usa o hook genérico
 * `useRealtimeInvalidate` (mesmo que o Perfil usa) em vez de uma
 * assinatura Supabase própria.
 */
export function useLibraryRealtimeSync() {
  useRealtimeInvalidate(LIBRARY_REALTIME_TABLES, LIBRARY_QUERY_KEY);
}
