import { NextResponse } from "next/server";
import { getMovieSummary, getSeriesSummary, type MediaSummary } from "@/lib/tmdb/client";
import { createAdminClient } from "@/lib/supabase/admin";

interface RequestBody {
  movieIds: number[];
  seriesIds: number[];
}

const MAX_IDS_PER_REQUEST = 100;

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

/** Só números inteiros positivos passam — filtra qualquer coisa que não seja um id de verdade. */
function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, MAX_IDS_PER_REQUEST);
}

type MediaType = "movie" | "series";

interface CacheRow {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  total_episodes: number | null;
  ended: boolean | null;
  runtime_minutes: number | null;
  release_date: string | null;
  genres: string[] | null;
}

function rowToSummary(row: CacheRow): MediaSummary {
  return {
    id: row.tmdb_id,
    title: row.title,
    year: row.year,
    posterPath: row.poster_path,
    totalEpisodes: row.total_episodes ?? undefined,
    ended: row.ended ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    releaseDate: row.release_date,
    genres: row.genres ?? undefined,
  };
}

async function readCache(
  admin: ReturnType<typeof createAdminClient>,
  mediaType: MediaType,
  ids: number[],
  language: string
): Promise<{ hits: Map<number, MediaSummary>; missingIds: number[] }> {
  if (ids.length === 0) return { hits: new Map(), missingIds: [] };

  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("media_summaries_cache")
    .select("tmdb_id, title, year, poster_path, total_episodes, ended, runtime_minutes, release_date, genres")
    .eq("media_type", mediaType)
    .eq("language", language)
    .in("tmdb_id", ids)
    .gte("fetched_at", cutoff);

  const hits = new Map<number, MediaSummary>();
  if (error) {
    // Cache é só uma otimização — se a leitura falhar, segue sem
    // cache (todo mundo vira "missing", busca no TMDB normalmente)
    // em vez de quebrar a resposta pro usuário.
    console.warn(`[api/tmdb/library-summaries] Falha ao ler cache de ${mediaType} — seguindo sem cache.`, error.message);
    return { hits, missingIds: ids };
  }

  for (const row of (data ?? []) as CacheRow[]) {
    hits.set(row.tmdb_id, rowToSummary(row));
  }

  return { hits, missingIds: ids.filter((id) => !hits.has(id)) };
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

  const movieIds = sanitizeIds(body.movieIds);
  const seriesIds = sanitizeIds(body.seriesIds);
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
  const [movieCache, seriesCache] = await Promise.all([
    readCache(admin, "movie", movieIds, language),
    readCache(admin, "series", seriesIds, language),
  ]);
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
