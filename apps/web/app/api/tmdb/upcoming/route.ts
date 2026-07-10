import { NextResponse } from "next/server";
import { getNextEpisodeToAir, type NextEpisodeToAir } from "@/lib/tmdb/client";

interface RequestBody {
  seriesIds: number[];
}

const MAX_IDS_PER_REQUEST = 100;

function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
    .slice(0, MAX_IDS_PER_REQUEST);
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tmdb/upcoming] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const seriesIds = sanitizeIds(body.seriesIds);

  try {
    const results = await Promise.all(seriesIds.map((id) => getNextEpisodeToAir(id)));
    const episodes: NextEpisodeToAir[] = results.filter((item): item is NextEpisodeToAir => item !== null);
    return NextResponse.json({ episodes });
  } catch (error) {
    console.error("[api/tmdb/upcoming] Falha ao buscar próximos episódios no TMDB.", error);
    return NextResponse.json({ error: "Não foi possível carregar os próximos episódios agora." }, { status: 502 });
  }
}
