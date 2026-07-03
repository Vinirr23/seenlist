import { NextResponse } from "next/server";
import { getMovieSummary, getSeriesSummary, type MediaSummary } from "@/lib/tmdb/client";

interface RequestBody {
  movieIds: number[];
  seriesIds: number[];
}

const MAX_IDS_PER_REQUEST = 100;

/** Só números inteiros positivos passam — filtra qualquer coisa que não seja um id de verdade. */
function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, MAX_IDS_PER_REQUEST);
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tmdb/library-summaries] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const movieIds = sanitizeIds(body.movieIds);
  const seriesIds = sanitizeIds(body.seriesIds);

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
