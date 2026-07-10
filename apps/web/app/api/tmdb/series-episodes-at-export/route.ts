import { NextResponse } from "next/server";
import { getAllEpisodesWithAirDates } from "@/lib/tmdb/client";

interface RequestBody {
  seriesIds: number[];
}

const MAX_IDS_PER_REQUEST = 20;

function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
    .slice(0, MAX_IDS_PER_REQUEST);
}

/**
 * TASK-027R — busca de episódios com air_date, série por série
 * (mais pesada que o resumo agregado de library-summaries, por isso
 * um lote menor). Promise.allSettled também no nível externo — uma
 * série com problema não derruba as outras do lote.
 */
export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tmdb/series-episodes-at-export] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const seriesIds = sanitizeIds(body.seriesIds);

  const settled = await Promise.allSettled(
    seriesIds.map(async (id) => ({
      id,
      episodes: await getAllEpisodesWithAirDates(String(id)),
    }))
  );

  const series: {
    id: number;
    episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[];
  }[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      series.push({
        id: outcome.value.id,
        episodes: outcome.value.episodes.map((e) => ({
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          airDate: e.airDate,
        })),
      });
    } else {
      console.error(
        `[api/tmdb/series-episodes-at-export] Falha ao buscar episódios da série ${seriesIds[index]} — as demais não são afetadas.`,
        outcome.reason
      );
    }
  });

  return NextResponse.json({ series });
}
