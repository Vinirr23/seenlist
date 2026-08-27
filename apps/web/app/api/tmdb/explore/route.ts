import { NextResponse } from "next/server";
import {
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
} from "@/lib/tmdb/client";

const LISTS = {
  trending_series: getTrendingSeries,
  trending_movies: getTrendingMovies,
  popular_series: getPopularSeries,
  popular_movies: getPopularMovies,
  upcoming_movies: getUpcomingMovies,
  on_the_air_series: getOnTheAirSeries,
} as const;

type ListKey = keyof typeof LISTS;

// Fase C da reformulação da Explorar (2026-08-21) — "Para você" e os
// chips de gênero precisam de uma lista filtrada por gênero, que
// exige um parâmetro extra (`genreId`) que as outras listas não têm
// — por isso não entram no mapa `LISTS` (que só chama `fn(language)`)
// e ganham um branch próprio abaixo.
const GENRE_LISTS = {
  genre_movies: getMoviesByGenre,
  genre_series: getSeriesByGenre,
} as const;

type GenreListKey = keyof typeof GENRE_LISTS;

// Fase D da reformulação da Explorar (2026-08-22) — "Porque você
// assistiu a [X]" precisa de uma lista filtrada por TÍTULO-ÂNCORA
// (recomendações/similares do TMDB pra 1 filme/série específico), não
// por gênero — parâmetro extra próprio (`anchorId`), mesmo padrão de
// `GENRE_LISTS`/`genreId` acima.
const SIMILAR_LISTS = {
  similar_movies: getSimilarMoviesForId,
  similar_series: getSimilarSeriesForId,
} as const;

type SimilarListKey = keyof typeof SIMILAR_LISTS;

/**
 * TASK-058 — uma rota só pra todas as listas de descoberta, em vez
 * de 6 rotas quase idênticas. `?list=trending_series` etc. `?genres=1`
 * inclui o mapa de gênero junto (evita uma segunda ida ao cliente
 * quando o card precisa mostrar o nome do gênero).
 *
 * CORREÇÃO (a pedido — "existe um limite de séries e filmes
 * recomendados?" → "implemente isso", 2026-08-22) — `?page=N` agora é
 * aceito em qualquer lista (default 1, mesmo comportamento de sempre
 * pra quem não passa nada — os carrosséis da tela principal nunca
 * passam). Resposta ganhou `page`/`totalPages` junto de `items`, pra
 * quem chama saber se tem mais pra buscar. `?source=` só se aplica às
 * listas de "similares" (Fase D) — ver comentário longo em
 * `getSimilarMoviesForId` sobre por que a origem (recommendations vs.
 * similar) precisa ser fixada a partir da página 2.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const list = searchParams.get("list") as ListKey | GenreListKey | SimilarListKey | null;
  const includeGenres = searchParams.get("genres") === "1";
  // A PEDIDO — capas do onboarding (mobile) vinham sempre em português, mesmo com o app noutro idioma. `?language=en-US` (formato TMDB, BCP 47) — sem o parâmetro, comportamento de sempre (pt-BR).
  const language = searchParams.get("language") ?? "pt-BR";
  const pageParam = searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "page inválida" }, { status: 400 });
  }

  if (list && list in SIMILAR_LISTS) {
    const anchorIdParam = searchParams.get("anchorId");
    const anchorId = anchorIdParam ? Number(anchorIdParam) : NaN;
    if (!anchorIdParam || Number.isNaN(anchorId)) {
      return NextResponse.json({ error: "anchorId obrigatório e numérico" }, { status: 400 });
    }
    const sourceParam = searchParams.get("source");
    const source = sourceParam === "recommendations" || sourceParam === "similar" ? sourceParam : undefined;
    try {
      // Sem genreMap aqui — diferente da tela "ver todos" de gênero
      // (`GenreAllView`), a tela "ver todos" deste carrossel
      // (`SimilarAllView`) já recebe o título-âncora pronto pela URL
      // (`?title=`), não precisa buscar nome de gênero nenhum.
      const result = await SIMILAR_LISTS[list as SimilarListKey](anchorId, page, language, source);
      return NextResponse.json({ ...result, genreMap: null });
    } catch (error) {
      console.error(`[api/tmdb/explore] Falha ao buscar lista "${list}" (anchorId=${anchorId}, page=${page})`, error);
      return NextResponse.json({ error: "Falha ao buscar dados do TMDB" }, { status: 502 });
    }
  }

  if (list && list in GENRE_LISTS) {
    const genreIdParam = searchParams.get("genreId");
    const genreId = genreIdParam ? Number(genreIdParam) : NaN;
    if (!genreIdParam || Number.isNaN(genreId)) {
      return NextResponse.json({ error: "genreId obrigatório e numérico" }, { status: 400 });
    }
    try {
      // Sempre inclui o genreMap aqui (não depende de `?genres=1`) —
      // a tela de "todos deste gênero" (GenreAllView) precisa do nome
      // do gênero pro título, e não tem de onde mais tirar isso.
      const [result, genreMap] = await Promise.all([
        GENRE_LISTS[list as GenreListKey](genreId, page, language),
        getGenreMap(language),
      ]);
      return NextResponse.json({ ...result, genreMap });
    } catch (error) {
      console.error(`[api/tmdb/explore] Falha ao buscar lista "${list}" (genreId=${genreId}, page=${page})`, error);
      return NextResponse.json({ error: "Falha ao buscar dados do TMDB" }, { status: 502 });
    }
  }

  if (!list || !(list in LISTS)) {
    return NextResponse.json({ error: "list inválida" }, { status: 400 });
  }

  try {
    const [result, genreMap] = await Promise.all([
      LISTS[list as ListKey](page, language),
      includeGenres ? getGenreMap(language) : Promise.resolve(null),
    ]);
    return NextResponse.json({ ...result, genreMap });
  } catch (error) {
    console.error(`[api/tmdb/explore] Falha ao buscar lista "${list}" (page=${page})`, error);
    return NextResponse.json({ error: "Falha ao buscar dados do TMDB" }, { status: 502 });
  }
}
