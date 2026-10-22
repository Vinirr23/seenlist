// supabase/functions/tmdb-catalog/index.ts
//
// CONTINUAÇÃO DA FASE 1 (migração mobile sem Vercel, 2026-10-20) —
// porta CINCO rotas web numa função só (ver comentário grande em
// `_shared/tmdbCatalog.ts` pro racional completo de por que viram Edge
// Function mesmo sendo passthrough puro de TMDB, e por que entraram
// numa function só em vez de 5):
//
//   operation "search"         ← apps/web/app/api/search/route.ts
//   operation "movie-details"  ← apps/web/app/api/tmdb/movie/[id]/route.ts
//   operation "explore"        ← apps/web/app/api/tmdb/explore/route.ts
//   operation "upcoming"       ← apps/web/app/api/tmdb/upcoming/route.ts
//   operation "genres"         ← apps/web/app/api/tmdb/genres/route.ts
//
// Nenhuma destas tem efeito colateral no Supabase — não recebem
// `supabase` nenhum, diferente de `series-data`. Nenhuma rota em
// `apps/web` foi tocada — isto é uma CÓPIA fiel.
//
// AUTENTICAÇÃO — mesmo modelo das outras 4 functions desta fase:
// `verify_jwt = true` (ver `supabase/config.toml`), token da sessão /
// anon key verificado automaticamente pelo Supabase antes de a
// function rodar, nenhuma lógica extra aqui.

import { jsonResponse, CORS_HEADERS } from "../_shared/tmdb.ts";
import {
  searchMovieAndSeries,
  getMovieDetails,
  getNextEpisodeToAir,
  getTrendingSeries,
  getTrendingMovies,
  getPopularSeries,
  getPopularMovies,
  getUpcomingMovies,
  getOnTheAirSeries,
  getMoviesByGenre,
  getSeriesByGenre,
  getSimilarMoviesForId,
  getSimilarSeriesForId,
  getGenreMap,
  getGenreMaps,
  type SimilarSource,
} from "../_shared/tmdbCatalog.ts";

// ---------------------------------------------------------------
// Operação "search" — mesmo payload de apps/web/app/api/search/route.ts.
// ---------------------------------------------------------------
async function handleSearch(query: string, language: string) {
  const trimmed = (query ?? "").trim().slice(0, 200);
  if (!trimmed) return { results: [] };
  const results = await searchMovieAndSeries(trimmed, language);
  return { results };
}

// ---------------------------------------------------------------
// Operação "movie-details" — mesmo payload de
// apps/web/app/api/tmdb/movie/[id]/route.ts (devolve o objeto
// MovieDetails direto, sem wrapper, igual a rota original).
// ---------------------------------------------------------------
async function handleMovieDetails(movieId: string, language: string) {
  return await getMovieDetails(movieId, language);
}

// ---------------------------------------------------------------
// Operação "upcoming" — mesmo payload de
// apps/web/app/api/tmdb/upcoming/route.ts.
// ---------------------------------------------------------------
async function handleUpcoming(seriesIds: number[], language: string) {
  const results = await Promise.all(seriesIds.map((id) => getNextEpisodeToAir(id, language)));
  const episodes = results.filter((item): item is NonNullable<typeof item> => item !== null);
  return { episodes };
}

// ---------------------------------------------------------------
// Operação "genres" — mesmo payload de
// apps/web/app/api/tmdb/genres/route.ts.
// ---------------------------------------------------------------
async function handleGenres(language: string) {
  const { movie, tv } = await getGenreMaps(language);
  return { movieGenreMap: movie, tvGenreMap: tv };
}

// ---------------------------------------------------------------
// Operação "explore" — mesmo payload/dispatch de
// apps/web/app/api/tmdb/explore/route.ts (list/genreId/anchorId/page/
// source/includeGenres), só que os parâmetros chegam no BODY (POST),
// não na query string (GET) — `supabase.functions.invoke` só manda
// corpo JSON, não aceita query string tão facilmente quanto `fetch`.
// Mobile (`discover.ts`) foi ajustado pra mandar os mesmos parâmetros
// dentro do body.
// ---------------------------------------------------------------
const SIMPLE_LISTS = {
  trending_series: getTrendingSeries,
  trending_movies: getTrendingMovies,
  popular_series: getPopularSeries,
  popular_movies: getPopularMovies,
  upcoming_movies: getUpcomingMovies,
  on_the_air_series: getOnTheAirSeries,
} as const;

const GENRE_LISTS = {
  genre_movies: getMoviesByGenre,
  genre_series: getSeriesByGenre,
} as const;

const SIMILAR_LISTS = {
  similar_movies: getSimilarMoviesForId,
  similar_series: getSimilarSeriesForId,
} as const;

interface ExploreParams {
  list?: string;
  genreId?: number;
  anchorId?: number;
  source?: SimilarSource;
  page?: number;
  language?: string;
  includeGenres?: boolean;
}

// CORREÇÃO (2026-10-20, validação da Fase 1 — aprovada pelo usuário) —
// `page` não tinha teto superior antes: um valor absurdo (ex.:
// 999999999) era aceito e repassado direto ao TMDB. TMDB limita
// `/discover`, `/trending`, etc. a no máximo 500 páginas (documentado
// na API deles) — valores fora de [1, 500] agora são rejeitados aqui,
// antes de qualquer chamada à TMDB, em vez de deixar a TMDB decidir o
// que fazer com um valor fora do intervalo que ela suporta.
const TMDB_MAX_PAGE = 500;

async function handleExplore(params: ExploreParams) {
  const list = params.list ?? "";
  const language = params.language ?? "pt-BR";

  if (params.page !== undefined && (!Number.isInteger(params.page) || params.page < 1 || params.page > TMDB_MAX_PAGE)) {
    throw new InvalidRequestError(`page deve ser um inteiro entre 1 e ${TMDB_MAX_PAGE}`);
  }
  const page = params.page ?? 1;

  if (list in SIMILAR_LISTS) {
    if (!params.anchorId || !Number.isInteger(params.anchorId)) {
      throw new InvalidRequestError("anchorId obrigatório e numérico");
    }
    const source = params.source === "recommendations" || params.source === "similar" ? params.source : undefined;
    const result = await SIMILAR_LISTS[list as keyof typeof SIMILAR_LISTS](params.anchorId, page, language, source);
    return { ...result, genreMap: null };
  }

  if (list in GENRE_LISTS) {
    if (!params.genreId || !Number.isInteger(params.genreId)) {
      throw new InvalidRequestError("genreId obrigatório e numérico");
    }
    const [result, genreMap] = await Promise.all([
      GENRE_LISTS[list as keyof typeof GENRE_LISTS](params.genreId, page, language),
      getGenreMap(language),
    ]);
    return { ...result, genreMap };
  }

  if (!(list in SIMPLE_LISTS)) {
    throw new InvalidRequestError("list inválida");
  }

  const [result, genreMap] = await Promise.all([
    SIMPLE_LISTS[list as keyof typeof SIMPLE_LISTS](page, language),
    params.includeGenres ? getGenreMap(language) : Promise.resolve(null),
  ]);
  return { ...result, genreMap };
}

class InvalidRequestError extends Error {}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  let body: Partial<{
    operation: string;
    query: string;
    movieId: string | number;
    seriesIds: number[];
    language: string;
  } & ExploreParams>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[tmdb-catalog] Corpo da requisição inválido.", error);
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const language = body.language || "pt-BR";

  try {
    if (body.operation === "search") {
      return jsonResponse(await handleSearch(body.query ?? "", language));
    }

    if (body.operation === "movie-details") {
      // CORREÇÃO (2026-10-20, validação da Fase 1 — aprovada pelo
      // usuário) — antes só exigia não-vazio; um `movieId` não numérico
      // não era vulnerabilidade (vai só pro path da URL de fetch, sem
      // SQL envolvido), mas resultava num 502 genérico via TMDB 404 em
      // vez de um 400 claro. Validado aqui como inteiro positivo ANTES
      // de montar a URL — mesma convenção já usada em `series-data`
      // para `seriesId`.
      const movieIdNum = Number(body.movieId);
      if (!Number.isInteger(movieIdNum) || movieIdNum <= 0) {
        return jsonResponse({ error: "movieId inválido — deve ser um inteiro positivo." }, 400);
      }
      return jsonResponse(await handleMovieDetails(String(movieIdNum), language));
    }

    if (body.operation === "upcoming") {
      const seriesIds = Array.isArray(body.seriesIds)
        ? body.seriesIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, 100)
        : [];
      return jsonResponse(await handleUpcoming(seriesIds, language));
    }

    if (body.operation === "genres") {
      return jsonResponse(await handleGenres(language));
    }

    if (body.operation === "explore") {
      return jsonResponse(await handleExplore(body));
    }

    return jsonResponse({ error: "Operação inválida. Use 'search', 'movie-details', 'upcoming', 'genres' ou 'explore'." }, 400);
  } catch (error) {
    if (error instanceof InvalidRequestError) {
      return jsonResponse({ error: error.message }, 400);
    }
    console.error(`[tmdb-catalog] Falha ao carregar operação "${body.operation}".`, error);
    return jsonResponse({ error: "Não foi possível carregar os dados do TMDB agora." }, 502);
  }
});
