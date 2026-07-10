import { NextResponse } from "next/server";
import { getEpisodeDetails, getSeriesWatchProviders, type EpisodeDetails } from "@/lib/tmdb/client";
import type { WatchProvider } from "@seenlist/types";

export interface EpisodePagePayload {
  episode: EpisodeDetails;
  watchProviders: WatchProvider[];
}

/**
 * TASK-030 — "buscar detalhes do episódio e providers em paralelo".
 * `Promise.all` aqui é seguro (diferente do lote de temporadas da
 * TASK-027F): são só DUAS chamadas relacionadas ao MESMO episódio,
 * não um lote de itens independentes — se uma falhar, a página
 * realmente não tem o que mostrar de qualquer forma.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ seriesId: string; season: string; episode: string }> }
) {
  const { seriesId, season, episode } = await params;
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
    return NextResponse.json({ error: "Temporada/episódio inválidos." }, { status: 400 });
  }

  try {
    const [episodeDetails, watchProviders] = await Promise.all([
      getEpisodeDetails(seriesId, seasonNumber, episodeNumber),
      getSeriesWatchProviders(seriesId).catch((error) => {
        console.error(`[api/tmdb/episode] Falha ao buscar providers da série ${seriesId}`, error);
        return [];
      }),
    ]);

    const payload: EpisodePagePayload = { episode: episodeDetails, watchProviders };
    return NextResponse.json(payload);
  } catch (error) {
    console.error(`[api/tmdb/episode] Falha ao carregar S${season}E${episode} da série ${seriesId}.`, error);
    return NextResponse.json({ error: "Não foi possível carregar o episódio agora." }, { status: 502 });
  }
}
