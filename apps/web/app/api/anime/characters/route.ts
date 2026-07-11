import { NextResponse } from "next/server";
import { getAnimeCharacters } from "@/lib/anime/jikan";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  if (!title) {
    return NextResponse.json({ error: "Parâmetro 'title' é obrigatório." }, { status: 400 });
  }

  const characters = await getAnimeCharacters(title, Number.isFinite(year) ? year : null);
  return NextResponse.json({ characters });
}
