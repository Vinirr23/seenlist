import { useQuery } from "@tanstack/react-query";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import type { MediaSummary } from "@/lib/tmdb/client";
import { useRealtimeInvalidate } from "@/lib/supabase/useRealtimeInvalidate";
import { STALE_TIME_LIBRARY } from "@/lib/queryStaleTimes";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { markElapsed, recordValue } from "@/lib/perfMarks";

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

export interface WatchedEpisodeStats {
  series_id: number;
  watched_count: number;
  last_watched_at: string;
}

/**
 * TEMPORÁRIO (aprofundando a investigação — o cache do TMDB já
 * ajudou, mas mesmo "quente" a etapa continuava em 1-2s, mais do que
 * uma leitura de Postgres deveria custar) — `timing` vem preenchido
 * pela própria rota (`api/tmdb/library-summaries/route.ts`), medido
 * DENTRO do servidor: quanto foi leitura do cache, quanto foi chamada
 * nova ao TMDB (pros ids que não estavam em cache) e quanto foi
 * escrever o resultado novo de volta no cache. Opcional (`?`) porque
 * uma resposta de erro (`response.ok` false) não passa por aqui.
 */
interface LibrarySummariesResponse {
  movies: MediaSummary[];
  series: MediaSummary[];
  timing?: {
    cacheReadMs: number;
    tmdbFetchMs: number;
    cacheWriteMs: number;
    totalMs: number;
    movieCacheHits: number;
    movieCacheMisses: number;
    seriesCacheHits: number;
    seriesCacheMisses: number;
  };
}

/**
 * ACHADO DE PERFORMANCE ("Home lenta", achado #2, corrigido) — antes,
 * esta função baixava CADA linha individual de `watched_episodes`
 * (paginada em lotes de 1000, pra não bater no limite padrão do
 * Supabase) só pra, no fim, usar apenas duas coisas por série:
 * contagem e data do mais recente. Pra conta com histórico grande,
 * isso é transferir milhares de linhas pela rede à toa.
 *
 * Agora chama `get_watched_episode_stats` (RPC, migration
 * `20260822000000` + correção `20260822000100`) — o Postgres já
 * devolve UMA linha por série, com a soma pronta. `security invoker`
 * na função (não `definer`) — continua respeitando exatamente a
 * mesma RLS de sempre (dono vê tudo; outra pessoa só vê se a
 * biblioteca for pública ou se for seguidor).
 *
 * Reaproveitada por `fetchLibraryItems` (biblioteca própria),
 * `recalculateUpToDateSeriesCategories` (seriesCategoryRecalc.ts),
 * `useSeriesActivityIds` (carrossel do Perfil), `useProfileSectionCounts`
 * (contador "Séries" do Perfil) e `usePublicLibraryItems` (biblioteca
 * de outro usuário) — as cinco tinham a mesma busca de linha-por-linha
 * duplicada.
 */
export async function fetchWatchedEpisodeStats(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<WatchedEpisodeStats[]> {
  const { data, error } = await supabase.rpc("get_watched_episode_stats", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as WatchedEpisodeStats[];
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

async function fetchOneLibrarySummariesPage(
  movieIds: number[],
  seriesIds: number[],
  language: string,
  pageIndex: number,
  batchStart: number
): Promise<LibrarySummariesResponse> {
  if (movieIds.length === 0 && seriesIds.length === 0) {
    return { movies: [], series: [] };
  }
  try {
    // TEMPORÁRIO (aprofundando a investigação do ~1-2s residual "quente")
    // — confirmado que o tempo DENTRO da rota (`tmdb_route_total_ms`) é
    // rápido (30-200ms) e o cache está 100% quente, mas o tempo total de
    // `series_home_data_loaded` continua em ~1,7-2,4s numa biblioteca com
    // várias páginas (400-800 itens = ~4-8 páginas de 100 ids, todas
    // disparadas juntas via `Promise.all` em `fetchDisplaySummaries`).
    // Duas explicações possíveis, ambas indistinguíveis olhando só pro
    // `tmdb_route_total_ms` de cada uma: (a) são todas concorrentes de
    // verdade e o gargalo é só latência de rede celular por requisição
    // (cada uma paga seu próprio round-trip), ou (b) o navegador está
    // ENFILEIRANDO as requisições (limite de conexões simultâneas por
    // host, comum em Safari mobile) e o que parece "paralelo" no código
    // na verdade roda em série na rede.
    //
    // `reqStart - batchStart` mede quanto tempo esta página específica
    // esperou pra sequer COMEÇAR a sair (depois que `Promise.all` foi
    // disparado) — se for (a), esse valor fica perto de 0 pra todas; se
    // for (b), cresce com o índice da página (a 5ª/6ª/7ª/8ª só começam
    // depois que conexões anteriores liberam). `reqEnd - reqStart` mede
    // o round-trip puro dessa página do ponto de vista do celular
    // (inclui rede + processamento do servidor).
    const reqStart = typeof performance !== "undefined" ? performance.now() : 0;
    const response = await fetch("/api/tmdb/library-summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds, seriesIds, language }),
    });
    const reqEnd = typeof performance !== "undefined" ? performance.now() : 0;
    recordValue(`tmdb_page${pageIndex}_start_offset_ms`, Math.round(reqStart - batchStart));
    recordValue(`tmdb_page${pageIndex}_roundtrip_ms`, Math.round(reqEnd - reqStart));
    if (!response.ok) {
      console.warn(
        `[library] /api/tmdb/library-summaries respondeu ${response.status} numa página — exibindo os itens desta página sem poster/título.`
      );
      return { movies: [], series: [] };
    }
    const result = (await response.json()) as LibrarySummariesResponse;

    // TEMPORÁRIO (aprofundando a investigação do TMDB "quente" ainda
    // levar 1-2s) — grava o breakdown que a própria rota mediu no
    // servidor. `recordValue` (não `mark`/`markElapsed`) porque estes
    // já vêm prontos em milissegundos, não são medidos daqui.
    if (result.timing) {
      recordValue("tmdb_route_cache_read_ms", result.timing.cacheReadMs);
      recordValue("tmdb_route_tmdb_fetch_ms", result.timing.tmdbFetchMs);
      recordValue("tmdb_route_cache_write_ms", result.timing.cacheWriteMs);
      recordValue("tmdb_route_total_ms", result.timing.totalMs);
      recordValue(
        "tmdb_route_cache_hit_rate_pct",
        Math.round(
          ((result.timing.movieCacheHits + result.timing.seriesCacheHits) /
            Math.max(
              1,
              result.timing.movieCacheHits +
                result.timing.movieCacheMisses +
                result.timing.seriesCacheHits +
                result.timing.seriesCacheMisses
            )) *
            100
        )
      );
    }

    return result;
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
/**
 * A PEDIDO — título/gênero/pôster desses resumos sempre vinham em
 * português. `language` opcional, default `"pt-BR"` — preserva TODO
 * comportamento já existente em quem chama sem passar nada; só quem
 * atualiza pra passar o idioma real do app recebe o dado no idioma
 * certo.
 */
export async function fetchDisplaySummaries(
  movieIds: number[],
  seriesIds: number[],
  language = "pt-BR"
): Promise<{ movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }> {
  if (movieIds.length === 0 && seriesIds.length === 0) {
    return { movies: {}, series: {} };
  }

  const movieChunks = chunkIds(movieIds, LIBRARY_SUMMARIES_PAGE_SIZE);
  const seriesChunks = chunkIds(seriesIds, LIBRARY_SUMMARIES_PAGE_SIZE);
  const pageCount = Math.max(movieChunks.length, seriesChunks.length, 1);

  // TEMPORÁRIO (mesma investigação do residual "quente" — ver comentário
  // grande em `fetchOneLibrarySummariesPage`) — `batchStart` é o
  // instante em que ESTE `Promise.all` foi disparado, ponto de
  // referência pra medir se cada página começa "junto" (paralela de
  // verdade) ou com atraso crescente (enfileirada pelo navegador).
  // `tmdb_pages_wall_ms` é quanto tempo o conjunto INTEIRO de páginas
  // levou — comparar contra a SOMA dos `roundtrip_ms` individuais:
  // se `wall_ms` ≈ soma, era serial; se `wall_ms` ≈ maior round-trip
  // individual, era paralelo de verdade.
  const batchStart = typeof performance !== "undefined" ? performance.now() : 0;
  recordValue("tmdb_pages_count", pageCount);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) =>
      fetchOneLibrarySummariesPage(movieChunks[index] ?? [], seriesChunks[index] ?? [], language, index, batchStart)
    )
  );
  markElapsed("tmdb_pages_wall_ms", batchStart);

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
  episodeStats: WatchedEpisodeStats[],
  summaries: { movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }
): LibraryItem[] {
  // Agregado já vem pronto do banco (get_watched_episode_stats) — só monta o mapa por série.
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
      // Maior entre "categoria mudou" e "episódio marcado" — qualquer
      // uma das duas conta como atividade recente de verdade.
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
      releaseDate: summary?.releaseDate ?? null,
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

/** Exportado (só visibilidade, TASK-034) pra ferramentas de comparação chamarem exatamente esta função — não uma reimplementação — garantindo fidelidade 100% com o que a tela real usa. */
export async function fetchLibraryItems(language = "pt-BR"): Promise<LibraryItem[]> {
  // TEMPORÁRIO (auditoria de performance — investigando LCP "poor" de
  // ~9-11s em /series, achado real com dado de teste em celular) —
  // marcas de checkpoint aqui dentro, não só na tela: `markElapsed`
  // é seguro de chamar de um arquivo que não é componente, contanto
  // que só rode no navegador (é sempre o caso aqui — `fetchLibraryItems`
  // só é chamado pelo `queryFn` do `useLibraryItems()`, client-side).
  const fetchStart = typeof performance !== "undefined" ? performance.now() : 0;

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
  /*
   * A PEDIDO — auditoria a fundo, mesmo padrão de bug já confirmado
   * em `check-new-releases` (Supabase corta em 1000 linhas por
   * padrão). Diferente daquele caso (consulta cruzando TODOS os
   * usuários, corte confirmado com dado real), aqui é uma consulta
   * por USUÁRIO — sem confirmação de que algum já passou de 1000
   * séries acompanhadas, mas o mesmo risco existe pra quem tem
   * biblioteca grande o bastante, então corrigido por precaução,
   * mesmo padrão de paginação (contagem primeiro, todas as páginas
   * em paralelo).
   *
   * CORREÇÃO (achado de performance nesta auditoria) — essa busca
   * paginada de `series_status` (contagem + páginas) NÃO tem nenhuma
   * dependência de dado com a busca de `movie_status`/estatísticas de
   * episódio logo abaixo — são três fontes independentes. Antes, o
   * código dava `await` nesta parte inteira ANTES de sequer começar a
   * buscar `movie_status`/episódios, serializando três idas ao banco
   * que podiam rodar juntas. Agora as três starts ao mesmo tempo
   * (`Promise.all` embrulhando tudo), sem mudar nem o dado retornado
   * nem o tratamento de erro — só a ordem em que as requisições saem.
   */
  const seriesStatusResultPromise = (async () => {
    const { count: seriesStatusCount } = await supabase
      .from("series_status")
      .select("series_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const SERIES_STATUS_PAGE_SIZE = 1000;
    const seriesStatusPages = await Promise.all(
      Array.from({ length: Math.ceil((seriesStatusCount ?? 0) / SERIES_STATUS_PAGE_SIZE) }, (_, i) =>
        supabase
          .from("series_status")
          .select("series_id, status, created_at, updated_at, total_watch_events")
          .eq("user_id", user.id)
          .range(i * SERIES_STATUS_PAGE_SIZE, i * SERIES_STATUS_PAGE_SIZE + SERIES_STATUS_PAGE_SIZE - 1)
      )
    );
    return {
      data: seriesStatusPages.flatMap((p) => p.data ?? []),
      error: seriesStatusPages.find((p) => p.error)?.error,
    };
  })();

  const [seriesResult, movieResult, episodeStats] = await Promise.all([
    seriesStatusResultPromise,
    supabase.from("movie_status").select("movie_id, status, created_at, updated_at").eq("user_id", user.id),
    fetchWatchedEpisodeStats(supabase, user.id),
  ]);
  markElapsed("lib_status_rows_done", fetchStart);

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
    ...episodeStats.map((stat) => stat.series_id),
  ]);
  for (const row of seriesRows) {
    if (row.status === "removed") validSeriesIds.delete(row.series_id);
  }

  const summaries = await fetchDisplaySummaries(
    movieRows.map((row) => row.movie_id),
    [...validSeriesIds],
    language
  );
  // TEMPORÁRIO (auditoria de performance) — se o salto entre
  // `lib_status_rows_done` e `lib_tmdb_summaries_done` for grande,
  // confirma que o gargalo está na busca de resumos do TMDB
  // (`/api/tmdb/library-summaries`), não nas consultas do Supabase.
  markElapsed("lib_tmdb_summaries_done", fetchStart);

  return buildLibraryItemsFromRows(movieRows, seriesRows, episodeStats, summaries);
}

/** A PEDIDO — pôster/título/gênero da Biblioteca sempre vinham em português. `locale` na `queryKey` garante rebusca ao trocar de idioma. */
export function useLibraryItems() {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, locale],
    queryFn: () => fetchLibraryItems(locale),
    staleTime: STALE_TIME_LIBRARY,
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
