import { NextResponse } from "next/server";
import { getMovieSummary, getSeriesSummary, type MediaSummary } from "@/lib/tmdb/client";

interface RequestBody {
  movieIds: number[];
  seriesIds: number[];
}

const MAX_IDS_PER_REQUEST = 100;

/** Só números inteiros positivos passam — filtra qualquer coisa que não seja um id de verdade. */
function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, MAX_IDS_PER_REQUEST);
}

/**
 * TASK-032 (correção) — mesmo bug já corrigido antes em
 * api/tvtime-import/season-info (TASK-027F) e
 * api/tvtime-out-import/find-by-external-id, só que aqui ninguém
 * tinha aplicado ainda: `Promise.all` com até 100 séries por lote
 * significa que UMA série com problema no TMDB derruba as outras 99
 * junto — e como `library-state.ts` usa `summary?.totalEpisodes ?? 0`
 * quando o resumo falta, essas 99 séries nunca conseguem virar "Em
 * dia" nem "Concluída" (ficam presas no status bruto), mesmo estando
 * corretas. `Promise.allSettled` isola cada item: uma falha vira só
 * uma ausência pontual, as demais completam normalmente.
 */
async function settleSummaries<T>(ids: number[], fetcher: (id: number) => Promise<T>, label: string): Promise<T[]> {
  const settled = await Promise.allSettled(ids.map((id) => fetcher(id)));
  const results: T[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      console.error(
        `[api/tmdb/library-summaries] Falha ao buscar resumo de ${label} ${ids[index]} — os demais não são afetados.`,
        outcome.reason
      );
    }
  });
  return results;
}

export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tmdb/library-summaries] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const movieIds = sanitizeIds(body.movieIds);
  const seriesIds = sanitizeIds(body.seriesIds);

  const [movies, series] = await Promise.all([
    settleSummaries(movieIds, getMovieSummary, "filme"),
    settleSummaries(seriesIds, getSeriesSummary, "série"),
  ]);

  const response: { movies: MediaSummary[]; series: MediaSummary[] } = { movies, series };
  return NextResponse.json(response);
}
