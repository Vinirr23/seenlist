import { NextResponse } from "next/server";
import { getSeriesDetails, getSeriesSeasonList, getSeasonEpisodes } from "@/lib/tmdb/client";
import type { SeriesDetails, SeasonWithEpisodes } from "@seenlist/types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") || "pt-BR";

  try {
    const [details, seasonList] = await Promise.all([
      getSeriesDetails(id, language),
      getSeriesSeasonList(id, language),
    ]);

    const seasons: SeasonWithEpisodes[] = await Promise.all(
      seasonList.map(async (season) => ({
        seasonNumber: season.seasonNumber,
        name: season.name,
        episodes: await getSeasonEpisodes(id, season.seasonNumber, language),
      }))
    );

    const payload: SeriesDetails = { ...details, seasons };
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`[api/tmdb/series/${id}] Falha ao carregar detalhes da série.`, error);
    return NextResponse.json({ error: "Não foi possível carregar a série agora." }, { status: 502 });
  }
}
