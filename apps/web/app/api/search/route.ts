import { NextResponse } from "next/server";
import { searchMovieAndSeries } from "@/lib/tmdb/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q")?.trim() ?? "").slice(0, 200);

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchMovieAndSeries(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[api/search] Falha ao buscar no TMDB.", error);
    return NextResponse.json({ error: "Não foi possível buscar agora." }, { status: 502 });
  }
}
