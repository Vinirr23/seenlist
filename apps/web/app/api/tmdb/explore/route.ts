import { NextResponse } from "next/server";
import {
  getTrendingSeries,
  getTrendingMovies,
  getPopularSeries,
  getPopularMovies,
  getUpcomingMovies,
  getOnTheAirSeries,
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

/**
 * TASK-058 — uma rota só pra todas as listas de descoberta, em vez
 * de 6 rotas quase idênticas. `?list=trending_series` etc. `?genres=1`
 * inclui o mapa de gênero junto (evita uma segunda ida ao cliente
 * quando o card precisa mostrar o nome do gênero).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const list = searchParams.get("list") as ListKey | null;
  const includeGenres = searchParams.get("genres") === "1";
  // A PEDIDO — capas do onboarding (mobile) vinham sempre em português, mesmo com o app noutro idioma. `?language=en-US` (formato TMDB, BCP 47) — sem o parâmetro, comportamento de sempre (pt-BR).
  const language = searchParams.get("language") ?? "pt-BR";

  if (!list || !(list in LISTS)) {
    return NextResponse.json({ error: "list inválida" }, { status: 400 });
  }

  try {
    const [items, genreMap] = await Promise.all([LISTS[list](language), includeGenres ? getGenreMap(language) : Promise.resolve(null)]);
    return NextResponse.json({ items, genreMap });
  } catch (error) {
    console.error(`[api/tmdb/explore] Falha ao buscar lista "${list}"`, error);
    return NextResponse.json({ error: "Falha ao buscar dados do TMDB" }, { status: 502 });
  }
}
