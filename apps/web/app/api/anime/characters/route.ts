import { NextResponse } from "next/server";
import { getAnimeCharacters, findMalIdWithDebug } from "@/lib/anime/jikan";
import { getAniListCharactersWithDebug } from "@/lib/anime/anilist";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  if (!title) {
    return NextResponse.json({ error: "Parâmetro 'title' é obrigatório." }, { status: 400 });
  }

  // TASK-168 — `?debug=1` devolve o que as DUAS fontes (AniList,
  // tentado primeiro, e Jikan, reforço) consideraram, pra investigar
  // sem precisar dos logs do Vercel.
  if (searchParams.get("debug") === "1") {
    const [aniList, jikan] = await Promise.all([
      getAniListCharactersWithDebug(title, Number.isFinite(year) ? year : null),
      findMalIdWithDebug(title, Number.isFinite(year) ? year : null),
    ]);
    return NextResponse.json({ aniList, jikan });
  }

  const result = await getAnimeCharacters(title, Number.isFinite(year) ? year : null);
  return NextResponse.json(result);
}
