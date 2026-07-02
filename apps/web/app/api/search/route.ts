import { NextResponse } from "next/server";
import { searchMovieAndSeries } from "@/lib/tmdb/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchMovieAndSeries(query);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Não foi possível buscar agora." }, { status: 502 });
  }
}
