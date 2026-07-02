import { NextResponse } from "next/server";
import { getSeriesDetails, getSeriesSeasonList, getSeasonEpisodes } from "@/lib/tmdb/client";
import type { SeriesDetails, SeasonWithEpisodes } from "@seenlist/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [details, seasonList] = await Promise.all([
      getSeriesDetails(id),
      getSeriesSeasonList(id),
    ]);

    const seasons: SeasonWithEpisodes[] = await Promise.all(
      seasonList.map(async (season) => ({
        seasonNumber: season.seasonNumber,
        name: season.name,
        episodes: await getSeasonEpisodes(id, season.seasonNumber),
      }))
    );

    const payload: SeriesDetails = { ...details, seasons };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a série agora." }, { status: 502 });
  }
}
