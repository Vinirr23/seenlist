import { NextResponse } from "next/server";
import { getMovieSummary, getSeriesSummary, type MediaSummary } from "@/lib/tmdb/client";

interface RequestBody {
  movieIds: number[];
  seriesIds: number[];
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const movieIds = body.movieIds ?? [];
  const seriesIds = body.seriesIds ?? [];

  try {
    const [movies, series] = await Promise.all([
      Promise.all(movieIds.map((id) => getMovieSummary(id))),
      Promise.all(seriesIds.map((id) => getSeriesSummary(id))),
    ]);

    const response: { movies: MediaSummary[]; series: MediaSummary[] } = { movies, series };
    return NextResponse.json(response);
  } catch (error) {
    console.error("[api/tmdb/library-summaries] Falha ao buscar resumos no TMDB.", error);
    return NextResponse.json({ error: "Não foi possível carregar os detalhes agora." }, { status: 502 });
  }
}
