// supabase/functions/library-summaries/index.ts
//
// FASE 1 (migração mobile sem Vercel, item 1, 2026-10-20) — porta
// `apps/web/app/api/tmdb/library-summaries/route.ts` pra uma Supabase
// Edge Function, SEM mudar nenhum comportamento: mesmo contrato de
// entrada/saída (POST { movieIds, seriesIds, language } → { movies,
// series, timing }), mesma leitura/escrita em `media_summaries_cache`
// (cache compartilhado entre TODOS os usuários, 24h de validade),
// mesma lógica de retry/concorrência contra a TMDB. Só o HOSPEDEIRO
// muda — a rota web em `apps/web` NÃO foi tocada (continua existindo,
// usada pelo site). Mobile passa a chamar esta function em vez da
// rota Vercel (ver `apps/mobile/lib/library.ts`).
//
// POR QUE PRECISA SER EDGE FUNCTION (não chamada direta à TMDB do
// mobile) — `media_summaries_cache` não tem NENHUMA policy de RLS
// (nem leitura), só é acessível via chave de serviço
// (`SUPABASE_SERVICE_ROLE_KEY`, que o mobile nunca pode ter). Sem essa
// Edge Function, o mobile perderia o cache compartilhado entre
// usuários — cada pessoa bateria direto na TMDB sempre, sem
// aproveitar o que outra conta já "esquentou".
//
// AUTENTICAÇÃO — mesmo modelo de qualquer outra chamada que o app já
// faz ao Supabase (RPC, tabela): o cliente (`supabase.functions.invoke`)
// manda o token da sessão atual (ou a anon key, se deslogado)
// automaticamente, e o Supabase verifica esse JWT antes de rotear pra
// função (`verify_jwt`, padrão do projeto — não precisa de nenhuma
// lógica extra aqui). Nenhum segredo (TMDB_API_KEY, SERVICE_ROLE_KEY)
// chega ao cliente — ambos ficam só nas variáveis de ambiente desta
// function, exatamente como hoje na rota Vercel.

// CORREÇÃO (2026-10-20, erro real de `deno check` reportado pelo
// usuário — ver `_shared/database.ts` pra causa raiz completa) —
// `createClient(...)` sem um `Database` genérico explícito faz esta
// versão do `@supabase/supabase-js` inferir `.from(tabela).upsert()`
// como `never[]`, e faz `ReturnType<typeof createClient>` (usado nas
// assinaturas de `readCacheCombined`/`writeCache` abaixo) resolver pra
// um tipo DIFERENTE do cliente real criado com argumentos — por isso
// agora o cliente é criado com `createClient<Database>(...)` e as
// funções auxiliares recebem `SupabaseClient<Database>`, não mais
// `ReturnType<typeof createClient>`.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { tmdbGet, jsonResponse, CORS_HEADERS, translateTvGenreName } from "../_shared/tmdb.ts";
import type { Database } from "../_shared/database.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface TmdbGenreListResponse {
  genres: { id: number; name: string }[];
}

async function getGenreMaps(language: string): Promise<{ movie: Record<number, string>; tv: Record<number, string> }> {
  const [movieGenres, tvGenresRaw] = await Promise.all([
    tmdbGet<TmdbGenreListResponse>("/genre/movie/list", { language }),
    tmdbGet<TmdbGenreListResponse>("/genre/tv/list", { language }),
  ]);
  const movie: Record<number, string> = {};
  for (const g of movieGenres.genres) movie[g.id] = g.name;
  const tv: Record<number, string> = {};
  for (const g of tvGenresRaw.genres) tv[g.id] = translateTvGenreName(g.name, language);
  return { movie, tv };
}

// ---------------------------------------------------------------
// MediaSummary — mesmo formato de `apps/web/lib/tmdb/client.ts`
// (MediaSummary) — o mobile já espera exatamente esta forma.
// ---------------------------------------------------------------
interface MediaSummary {
  id: number;
  title: string;
  originalTitle?: string;
  year: number | null;
  posterPath: string | null;
  totalEpisodes?: number;
  ended?: boolean;
  runtimeMinutes?: number;
  releaseDate?: string | null;
  genres?: string[];
  voteAverage?: number;
  voteCount?: number;
  genreIds?: number[];
  productionCountries?: string[];
  originCountries?: string[];
}

interface TmdbMovieSummaryResponse {
  id: number;
  title: string;
  original_title: string;
  release_date: string | null;
  poster_path: string | null;
  runtime: number | null;
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  production_countries: { iso_3166_1: string; name: string }[];
}

async function getMovieSummary(movieId: number, language: string): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbMovieSummaryResponse>(`/movie/${movieId}`, { language });
  return {
    id: data.id,
    title: data.title,
    originalTitle: data.original_title,
    year: data.release_date ? Number(data.release_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    runtimeMinutes: data.runtime ?? undefined,
    releaseDate: data.release_date ?? null,
    genres: (data.genres ?? []).map((g) => g.name),
    genreIds: (data.genres ?? []).map((g) => g.id),
    productionCountries: (data.production_countries ?? []).map((c) => c.iso_3166_1),
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
  };
}

interface TmdbSeriesSummaryResponse {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string | null;
  poster_path: string | null;
  number_of_episodes: number;
  status: string;
  in_production: boolean;
  episode_run_time: number[];
  seasons: { season_number: number; episode_count: number }[];
  genres: { id: number; name: string }[];
  vote_average: number;
  vote_count: number;
  origin_country: string[];
}

const DEFAULT_EPISODE_RUNTIME_MINUTES = 45;

async function getSeriesSummary(seriesId: number, language: string): Promise<MediaSummary> {
  const data = await tmdbGet<TmdbSeriesSummaryResponse>(`/tv/${seriesId}`, { language });
  const totalEpisodesExcludingSpecials = data.seasons
    .filter((season) => season.season_number >= 1)
    .reduce((sum, season) => sum + season.episode_count, 0);

  return {
    id: data.id,
    title: data.name,
    originalTitle: data.original_name,
    year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) || null : null,
    posterPath: data.poster_path,
    totalEpisodes: totalEpisodesExcludingSpecials || data.number_of_episodes,
    ended: (data.status === "Ended" || data.status === "Canceled") && !data.in_production,
    runtimeMinutes: data.episode_run_time?.[0] || DEFAULT_EPISODE_RUNTIME_MINUTES,
    genres: (data.genres ?? []).map((g) => translateTvGenreName(g.name, language)),
    genreIds: (data.genres ?? []).map((g) => g.id),
    originCountries: data.origin_country ?? [],
    voteAverage: data.vote_average,
    voteCount: data.vote_count,
  };
}

// ---------------------------------------------------------------
// `media_summaries_cache` — leitura/escrita EXATAMENTE igual à rota
// web (`readCacheCombined`/`writeCache`/`CACHE_TTL_HOURS`).
// ---------------------------------------------------------------
const CACHE_TTL_HOURS = 24;
const MAX_IDS_PER_REQUEST = 5000;

type MediaType = "movie" | "series";

interface CacheRow {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  total_episodes: number | null;
  ended: boolean | null;
  runtime_minutes: number | null;
  release_date: string | null;
  genres: number[] | null;
  production_countries: string[] | null;
  origin_countries: string[] | null;
  vote_average: number | null;
  vote_count: number | null;
}

function sanitizeIds(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  if (valid.length > MAX_IDS_PER_REQUEST) {
    console.error(`[library-summaries] ${valid.length} ids de ${label} recebidos, acima do teto de segurança (${MAX_IDS_PER_REQUEST}) — os ${valid.length - MAX_IDS_PER_REQUEST} excedentes foram descartados.`);
  }
  return valid.slice(0, MAX_IDS_PER_REQUEST);
}

function rowToSummary(row: CacheRow, genreMaps: { movie: Record<number, string>; tv: Record<number, string> }): MediaSummary {
  const genreMap = row.media_type === "series" ? genreMaps.tv : genreMaps.movie;
  return {
    id: row.tmdb_id,
    title: row.title,
    originalTitle: row.original_title ?? undefined,
    year: row.year,
    posterPath: row.poster_path,
    totalEpisodes: row.total_episodes ?? undefined,
    ended: row.ended ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    releaseDate: row.release_date,
    genres: row.genres?.map((id) => genreMap[id]).filter((name): name is string => Boolean(name)),
    genreIds: row.genres ?? undefined,
    productionCountries: row.production_countries ?? undefined,
    originCountries: row.origin_countries ?? undefined,
    voteAverage: row.vote_average ?? undefined,
    voteCount: row.vote_count ?? undefined,
  };
}

async function readCacheCombined(
  supabase: SupabaseClient<Database>,
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

  const { data, error } = await supabase
    .from("media_summaries_cache")
    .select(
      "tmdb_id, media_type, title, original_title, year, poster_path, total_episodes, ended, runtime_minutes, release_date, genres, production_countries, origin_countries, vote_average, vote_count"
    )
    .eq("language", language)
    .gte("fetched_at", cutoff)
    .or(orParts.join(","));

  const movieHits = new Map<number, MediaSummary>();
  const seriesHits = new Map<number, MediaSummary>();

  if (error) {
    console.error(`[library-summaries] FALHA AO LER media_summaries_cache — seguindo sem cache (toda esta página vai bater na TMDB diretamente).`, error.message);
    return {
      movie: { hits: movieHits, missingIds: movieIds },
      series: { hits: seriesHits, missingIds: seriesIds },
    };
  }

  const genreMaps = await getGenreMaps(language);

  for (const row of (data ?? []) as CacheRow[]) {
    if (row.media_type === "movie") movieHits.set(row.tmdb_id, rowToSummary(row, genreMaps));
    else seriesHits.set(row.tmdb_id, rowToSummary(row, genreMaps));
  }

  return {
    movie: { hits: movieHits, missingIds: movieIds.filter((id) => !movieHits.has(id)) },
    series: { hits: seriesHits, missingIds: seriesIds.filter((id) => !seriesHits.has(id)) },
  };
}

async function writeCache(
  supabase: SupabaseClient<Database>,
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
    original_title: summary.originalTitle ?? null,
    year: summary.year,
    poster_path: summary.posterPath,
    total_episodes: summary.totalEpisodes ?? null,
    ended: summary.ended ?? null,
    runtime_minutes: summary.runtimeMinutes ?? null,
    release_date: summary.releaseDate ?? null,
    genres: summary.genreIds ?? null,
    production_countries: mediaType === "movie" ? summary.productionCountries ?? null : null,
    origin_countries: mediaType === "series" ? summary.originCountries ?? null : null,
    vote_average: summary.voteAverage ?? null,
    vote_count: summary.voteCount ?? null,
    fetched_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("media_summaries_cache").upsert(rows, { onConflict: "media_type,tmdb_id,language" });
  if (error) {
    console.error(`[library-summaries] FALHA AO GRAVAR media_summaries_cache (${mediaType}, ${summaries.length} linha(s)) — próxima requisição bate na TMDB de novo pra estes ids.`, error.message);
  }
}

async function settleSummaries<T>(ids: number[], fetcher: (id: number) => Promise<T>, label: string): Promise<T[]> {
  const CONCURRENCY = 20;
  const results: T[] = [];

  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const batchIds = ids.slice(start, start + CONCURRENCY);
    const settled = await Promise.allSettled(batchIds.map((id) => fetcher(id)));

    const retryIds: number[] = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") results.push(outcome.value);
      else retryIds.push(batchIds[index]!);
    });

    if (retryIds.length > 0) {
      const retried = await Promise.allSettled(retryIds.map((id) => fetcher(id)));
      retried.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") results.push(outcome.value);
        else console.error(`[library-summaries] Falha ao buscar resumo de ${label} ${retryIds[index]} (2 tentativas) — os demais não são afetados.`, outcome.reason);
      });
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  let body: Partial<{ movieIds: unknown; seriesIds: unknown; language: string }>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[library-summaries] Corpo da requisição inválido.", error);
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const movieIds = sanitizeIds(body.movieIds, "filmes");
  const seriesIds = sanitizeIds(body.seriesIds, "séries");
  const language = body.language || "pt-BR";

  const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

  const routeStart = Date.now();
  const cacheReadStart = Date.now();
  const { movie: movieCache, series: seriesCache } = await readCacheCombined(supabase, movieIds, seriesIds, language);
  const cacheReadMs = Date.now() - cacheReadStart;

  const tmdbFetchStart = Date.now();
  const [freshMovies, freshSeries] = await Promise.all([
    settleSummaries(movieCache.missingIds, (id) => getMovieSummary(id, language), "filme"),
    settleSummaries(seriesCache.missingIds, (id) => getSeriesSummary(id, language), "série"),
  ]);
  const tmdbFetchMs = Date.now() - tmdbFetchStart;

  const cacheWriteStart = Date.now();
  await Promise.all([
    writeCache(supabase, "movie", language, freshMovies),
    writeCache(supabase, "series", language, freshSeries),
  ]);
  const cacheWriteMs = Date.now() - cacheWriteStart;

  return jsonResponse({
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
  });
});
