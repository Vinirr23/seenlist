import { NextResponse } from "next/server";
import { getMovieSummary, getSeriesSummary, translateTvGenreName, type MediaSummary } from "@/lib/tmdb/client";
import { createAdminClient } from "@/lib/supabase/admin";

interface RequestBody {
  movieIds: number[];
  seriesIds: number[];
}

/**
 * CORREÇÃO (investigação do residual "quente" de ~1-2s numa biblioteca
 * grande, ~1000 itens) — esse limite de 100 (original, TASK-038) vinha
 * de QUANDO esta rota buscava direto no TMDB, pra não estourar o rate
 * limit deles com lotes grandes. Com a leitura primária no NOSSO cache
 * (`media_summaries_cache`, uma query só de Postgres), essa razão não
 * existe mais — mas dado real (10ª rodada) mostrou que mandar TUDO
 * numa chamada só também não é o ideal: uma query/payload únicos
 * muito grandes saem mais lentos que várias chamadas paralelas
 * menores (ver comentário grande em `fetchOneLibrarySummariesPage`,
 * `library-state.ts`). `library-state.ts` pagina em lotes de 100
 * (`LIBRARY_SUMMARIES_PAGE_SIZE` — testado também com 200 nas
 * rodadas 10-12, mas revertido: dado real de duas rodadas, uma delas
 * com controle limpo, mostrou 200 mais lento que 100). Esse número
 * aqui NÃO precisa bater exatamente com o tamanho de página do
 * cliente (diferente do acoplamento rígido do TASK-038 original):
 * como o cliente nunca manda mais que 100 ids por chamada, e este
 * teto está bem acima disso, é só uma proteção de segurança contra
 * corpo de requisição/tamanho de query absurdos — não o "tamanho de
 * página" de ninguém.
 */
const MAX_IDS_PER_REQUEST = 5000;

/**
 * ACHADO DE PERFORMANCE (LCP "poor" de 9-11s em /series, confirmado
 * com dado real de celular e isolado com instrumentação — ver
 * `checkpoints lib_status_rows_done`/`lib_tmdb_summaries_done` em
 * `lib/queries/library-state.ts`): em cache frio, ~4,6s dos ~6s que a
 * Biblioteca levava pra carregar iam pra esta rota, buscando o resumo
 * de CADA série/filme no TMDB, um por um. O cache de 5 min do Next
 * (`next: { revalidate }`, dentro de `tmdbGet`) só ajuda em recargas
 * MUITO próximas — na carga comum do dia, tudo vem frio.
 *
 * `media_summaries_cache` (migration `20260905000000`) guarda o
 * resumo de cada série/filme já buscado, COMPARTILHADO ENTRE TODOS OS
 * USUÁRIOS — diferente do cache do Next (por deployment/instância),
 * este é uma tabela de verdade: a primeira pessoa que abre uma série
 * popular "esquenta" o cache pra todas as outras que também
 * acompanham ela, não só pra ela mesma. Validade de `CACHE_TTL_HOURS`
 * — dado do TMDB (título/pôster/contagem de episódios) muda pouco de
 * um dia pro outro, e episódio novo já tem seu próprio fluxo de
 * detecção, diário (`check-new-releases`).
 *
 * Só esta rota (servidor) lê/escreve nesta tabela — usa
 * `createAdminClient()` (chave de serviço, ignora RLS) de propósito:
 * a tabela não tem NENHUMA policy (nem de leitura), então nem um
 * usuário autenticado consegue ler direto — é puramente um cache
 * interno do servidor, não um dado que o app expõe.
 */
const CACHE_TTL_HOURS = 24;

/**
 * Só números inteiros positivos passam — filtra qualquer coisa que não
 * seja um id de verdade.
 *
 * TASK-038 — "nunca mais pode existir descarte silencioso": se algum
 * dia uma biblioteca passar do teto de segurança (`MAX_IDS_PER_REQUEST`),
 * os ids excedentes ainda seriam cortados aqui — mas agora com aviso
 * explícito, em vez de sumir sem rastro como acontecia antes.
 */
function sanitizeIds(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  if (valid.length > MAX_IDS_PER_REQUEST) {
    console.error(
      `[api/tmdb/library-summaries] ${valid.length} ids de ${label} recebidos, acima do teto de segurança (${MAX_IDS_PER_REQUEST}) — os ${valid.length - MAX_IDS_PER_REQUEST} excedentes foram descartados.`
    );
  }
  return valid.slice(0, MAX_IDS_PER_REQUEST);
}

type MediaType = "movie" | "series";

interface CacheRow {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  year: number | null;
  poster_path: string | null;
  total_episodes: number | null;
  ended: boolean | null;
  runtime_minutes: number | null;
  release_date: string | null;
  genres: string[] | null;
}

/**
 * CORREÇÃO (a pedido, investigado até a causa raiz — chips de gênero
 * de SÉRIE em inglês, 2026-08-22) — ver `translateTvGenreName` em
 * `lib/tmdb/client.ts` pro histórico completo: o TMDB nunca traduziu 8
 * gêneros de série pro português, então linhas já gravadas em
 * `media_summaries_cache` ANTES desta correção guardam esses nomes em
 * inglês. `getSeriesSummary` (ver `client.ts`) já corrige toda busca
 * NOVA — mas sem reaplicar a tradução aqui também, quem já tem uma
 * linha em cache (válida por até 24h) continuaria vendo inglês até o
 * cache expirar sozinho. Aplicar de novo aqui, na LEITURA, corrige na
 * hora, sem esperar.
 */
function rowToSummary(row: CacheRow, language: string): MediaSummary {
  return {
    id: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    totalEpisodes: row.total_episodes ?? undefined,
    ended: row.ended ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    releaseDate: row.release_date,
    genres: row.media_type === "series" ? row.genres?.map((name) => translateTvGenreName(name, language)) : row.genres ?? undefined,
  };
}

/**
 * CORREÇÃO (achado real, 14ª rodada — investigação do "abrir
 * instantâneo", depois do revert pra lotes de 100) — antes, cada
 * página (até 100 filmes + até 100 séries) disparava DUAS leituras
 * de `media_summaries_cache` em paralelo (`readCache` de filme e de
 * série, cada uma sua própria ida ao Postgres). Com até 10 páginas
 * batendo ao mesmo tempo (paralelismo da Frente 1), isso virava até
 * 20 conexões simultâneas contra o mesmo banco.
 *
 * Confirmado direto no painel do Supabase (Database → Connection
 * pooling): plano Nano, pool de só 15 conexões. Nos logs do Postgres
 * do horário exato de um teste real de celular apareceram erros
 * "Warp server error: Thread killed by timeout manager" — sintoma de
 * requisição esperando conexão que não sobrou no pool — e no mesmo
 * teste, `tmdb_route_cache_read_ms` (medido inteiramente DENTRO do
 * servidor, sem nenhuma influência de rede do celular) saiu elevado
 * (742-960ms) em 6 das 8 páginas de `/series` capturadas, enquanto
 * `/profile` (mesma rota, mas só 1 página, sem rajada concorrente) se
 * manteve rápido (46-223ms) no MESMO teste. Confirma contenção de
 * conexão, não física de rede — a causa raiz real desta vez.
 *
 * Correção: uma query só por página, combinando filme e série com
 * `.or()` (`media_type.eq.movie AND tmdb_id IN (...)` OU o mesmo pra
 * série) — corta pela METADE as conexões simultâneas por página, sem
 * mudar tamanho de página nem UX nenhuma. `writeCache` continua
 * separado por tipo (só roda em cache miss, `tmdb_route_cache_write_ms`
 * sempre 0 em todos os testes reais até agora — não é o gargalo).
 */
async function readCacheCombined(
  admin: ReturnType<typeof createAdminClient>,
  movieIds: number[],
  seriesIds: number[],
  language: string
): Promise<{
  movie: { hits: Map<number, MediaSummary>; missingIds: number[] };
  series: { hits: Map<number, MediaSummary>; missingIds: number[] };
}> {
  const empty = { hits: new Map<number, MediaSummary>(), missingIds: [] as number[] };
  if (movieIds.length === 0 && seriesIds.length === 0) {
    return { movie: empty, series: { ...empty } };
  }

  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const orParts: string[] = [];
  if (movieIds.length > 0) orParts.push(`and(media_type.eq.movie,tmdb_id.in.(${movieIds.join(",")}))`);
  if (seriesIds.length > 0) orParts.push(`and(media_type.eq.series,tmdb_id.in.(${seriesIds.join(",")}))`);

  const { data, error } = await admin
    .from("media_summaries_cache")
    .select("tmdb_id, media_type, title, year, poster_path, total_episodes, ended, runtime_minutes, release_date, genres")
    .eq("language", language)
    .gte("fetched_at", cutoff)
    .or(orParts.join(","));

  const movieHits = new Map<number, MediaSummary>();
  const seriesHits = new Map<number, MediaSummary>();

  if (error) {
    // Cache é só uma otimização — se a leitura falhar, segue sem
    // cache (todo mundo vira "missing", busca no TMDB normalmente)
    // em vez de quebrar a resposta pro usuário.
    console.warn(`[api/tmdb/library-summaries] Falha ao ler cache combinado — seguindo sem cache.`, error.message);
    return {
      movie: { hits: movieHits, missingIds: movieIds },
      series: { hits: seriesHits, missingIds: seriesIds },
    };
  }

  for (const row of (data ?? []) as CacheRow[]) {
    if (row.media_type === "movie") movieHits.set(row.tmdb_id, rowToSummary(row, language));
    else seriesHits.set(row.tmdb_id, rowToSummary(row, language));
  }

  return {
    movie: { hits: movieHits, missingIds: movieIds.filter((id) => !movieHits.has(id)) },
    series: { hits: seriesHits, missingIds: seriesIds.filter((id) => !seriesHits.has(id)) },
  };
}

async function writeCache(
  admin: ReturnType<typeof createAdminClient>,
  mediaType: MediaType,
  language: string,
  summaries: MediaSummary[]
): Promise<void> {
  if (summaries.length === 0) return;

  const rows = summaries.map((summary) => ({
    media_type: mediaType,
    tmdb_id: summary.id,
    language,
    title: summary.title,
    year: summary.year,
    poster_path: summary.posterPath,
    total_episodes: summary.totalEpisodes ?? null,
    ended: summary.ended ?? null,
    runtime_minutes: summary.runtimeMinutes ?? null,
    release_date: summary.releaseDate ?? null,
    genres: summary.genres ?? null,
    fetched_at: new Date().toISOString(),
  }));

  // Gravar o cache nunca pode derrubar a resposta ao usuário — só
  // registra o aviso e segue (a próxima requisição tenta de novo).
  const { error } = await admin.from("media_summaries_cache").upsert(rows, { onConflict: "media_type,tmdb_id,language" });
  if (error) {
    console.warn(`[api/tmdb/library-summaries] Falha ao gravar cache de ${mediaType}.`, error.message);
  }
}

/**
 * TASK-032 (correção) — mesmo bug já corrigido antes em
 * api/tvtime-import/season-info (TASK-027F) e
 * api/tvtime-out-import/find-by-external-id, só que aqui ninguém
 * tinha aplicado ainda: `Promise.all` com até 100 séries por lote
 * significa que UMA série com problema no TMDB derruba as outras 99
 * junto — e como `library-state.ts` usa `summary?.totalEpisodes ?? 0`
 * quando o resumo falta, essas 99 séries nunca conseguem virar "Em
 * dia" nem "Concluída" (ficam presas no status bruto), mesmo estando
 * corretas. `Promise.allSettled` isola cada item: uma falha vira só
 * uma ausência pontual, as demais completam normalmente.
 */
/**
 * TASK-172 (achado real — pôster parava de carregar "depois de uma
 * certa quantidade" de filmes assistidos) — antes, uma página de até
 * 100 ids disparava as 100 chamadas ao TMDB TODAS AO MESMO TEMPO
 * (`Promise.allSettled` sem limite nenhum de simultaneidade).
 * Quanto mais filme/série na conta, maior a rajada, maior a chance
 * de bater num limite de taxa do TMDB no meio da rajada — os que
 * falhassem por causa disso simplesmente sumiam (sem pôster), sem
 * segunda chance. Agora processa em lotes menores (10 por vez) e dá
 * uma segunda tentativa pro que falhar — mesmo raciocínio já
 * aplicado antes pro Jikan/Trakt.
 *
 * IMPORTANTE — não subir `CONCURRENCY` sem cuidado: essa é
 * exatamente a mudança que já causou rate-limiting real do TMDB
 * antes (ver TASK-172 acima). Com o cache novo (`media_summaries_cache`),
 * esta função só roda pros ids que NÃO estão em cache — bem menos
 * chamadas na prática do que antes, o que já reduz a pressão sem
 * precisar mexer neste número.
 */
async function settleSummaries<T>(ids: number[], fetcher: (id: number) => Promise<T>, label: string): Promise<T[]> {
  const CONCURRENCY = 20;
  const results: T[] = [];

  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const batchIds = ids.slice(start, start + CONCURRENCY);
    const settled = await Promise.allSettled(batchIds.map((id) => fetcher(id)));

    const retryIds: number[] = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        retryIds.push(batchIds[index]!);
      }
    });

    if (retryIds.length > 0) {
      const retried = await Promise.allSettled(retryIds.map((id) => fetcher(id)));
      retried.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          results.push(outcome.value);
        } else {
          console.error(
            `[api/tmdb/library-summaries] Falha ao buscar resumo de ${label} ${retryIds[index]} (2 tentativas) — os demais não são afetados.`,
            outcome.reason
          );
        }
      });
    }
  }

  return results;
}

export async function POST(request: Request) {
  let body: Partial<RequestBody & { language: string }>;
  try {
    body = (await request.json()) as Partial<RequestBody & { language: string }>;
  } catch (error) {
    console.error("[api/tmdb/library-summaries] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const movieIds = sanitizeIds(body.movieIds, "filmes");
  const seriesIds = sanitizeIds(body.seriesIds, "séries");
  const language = body.language || "pt-BR";

  // TEMPORÁRIO (aprofundando a investigação — mesmo com cache
  // "quente" a etapa continuava levando 1-2s no dado real de teste, a
  // mais do que uma leitura de Postgres deveria custar) — timers por
  // etapa DENTRO da rota, mandados de volta na resposta em `timing`
  // pro cliente gravar via `recordValue` (ver `perfMarks.ts`).
  // `Date.now()` aqui, não `performance.now()` — este código roda no
  // servidor (função serverless da Vercel), onde não existe
  // `performance.timeOrigin` de navegação de página fazendo sentido.
  const routeStart = Date.now();
  const admin = createAdminClient();

  const cacheReadStart = Date.now();
  const { movie: movieCache, series: seriesCache } = await readCacheCombined(admin, movieIds, seriesIds, language);
  const cacheReadMs = Date.now() - cacheReadStart;

  const tmdbFetchStart = Date.now();
  const [freshMovies, freshSeries] = await Promise.all([
    settleSummaries(movieCache.missingIds, (id) => getMovieSummary(id, language), "filme"),
    settleSummaries(seriesCache.missingIds, (id) => getSeriesSummary(id, language), "série"),
  ]);
  const tmdbFetchMs = Date.now() - tmdbFetchStart;

  // Grava no cache ANTES de responder — assim a próxima pessoa (ou a
  // próxima carga desta mesma) já encontra pronto. Falha aqui não
  // derruba a resposta (ver `writeCache`).
  const cacheWriteStart = Date.now();
  await Promise.all([
    writeCache(admin, "movie", language, freshMovies),
    writeCache(admin, "series", language, freshSeries),
  ]);
  const cacheWriteMs = Date.now() - cacheWriteStart;

  const response: {
    movies: MediaSummary[];
    series: MediaSummary[];
    timing: {
      cacheReadMs: number;
      tmdbFetchMs: number;
      cacheWriteMs: number;
      totalMs: number;
      movieCacheHits: number;
      movieCacheMisses: number;
      seriesCacheHits: number;
      seriesCacheMisses: number;
    };
  } = {
    movies: [...movieCache.hits.values(), ...freshMovies],
    series: [...seriesCache.hits.values(), ...freshSeries],
    timing: {
      cacheReadMs,
      tmdbFetchMs,
      cacheWriteMs,
      totalMs: Date.now() - routeStart,
      movieCacheHits: movieCache.hits.size,
      movieCacheMisses: movieCache.missingIds.length,
      seriesCacheHits: seriesCache.hits.size,
      seriesCacheMisses: seriesCache.missingIds.length,
    },
  };
  return NextResponse.json(response);
}
