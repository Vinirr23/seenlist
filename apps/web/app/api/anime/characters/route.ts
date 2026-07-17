import { NextResponse } from "next/server";
import { getAnimeCharacters, findMalIdWithDebug } from "@/lib/anime/jikan";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  if (!title) {
    return NextResponse.json({ error: "Parâmetro 'title' é obrigatório." }, { status: 400 });
  }

  // TASK-168 — `?debug=1` devolve o que a busca no MyAnimeList
  // considerou (candidatos e pontuações), pra investigar sem precisar
  // dos logs do Vercel. Ex.: /api/anime/characters?title=That+Time+I+Got+Reincarnated+as+a+Slime&year=2018&debug=1
  if (searchParams.get("debug") === "1") {
    const debugInfo = await findMalIdWithDebug(title, Number.isFinite(year) ? year : null);
    return NextResponse.json(debugInfo);
  }

  const characters = await getAnimeCharacters(title, Number.isFinite(year) ? year : null);
  return NextResponse.json({ characters });
}
