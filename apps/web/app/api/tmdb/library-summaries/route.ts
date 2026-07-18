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
/**
 * TASK-172 (achado real — pôster parava de carregar "depois de uma
 * certa quantidade" de filmes assistidos) — antes, uma página de até
 * 100 ids disparava as 100 chamadas ao TMDB TODAS AO MESMO TEMPO
 * (`Promise.allSettled` sem limite nenhum de simultaneidade).
 * Quanto mais filme/série na conta, maior a rajada, maior a chance
 * de bater num limite de taxa do TMDB no meio da rajada — os que
 * falhassem por causa disso simplesmente sumiam (sem pôster), sem
 * segunda chance. Agora processa em lotes menores (10 por vez) e dá
 * uma segunda tentativa pro que falhar — mesmo raciocínio já
 * aplicado antes pro Jikan/Trakt.
 */
async function settleSummaries<T>(ids: number[], fetcher: (id: number) => Promise<T>, label: string): Promise<T[]> {
  const CONCURRENCY = 20;
  const results: T[] = [];

  for (let start = 0; start < ids.length; start += CONCURRENCY) {
    const batchIds = ids.slice(start, start + CONCURRENCY);
    const settled = await Promise.allSettled(batchIds.map((id) => fetcher(id)));

    const retryIds: number[] = [];
    settled.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        retryIds.push(batchIds[index]!);
      }
    });

    if (retryIds.length > 0) {
      const retried = await Promise.allSettled(retryIds.map((id) => fetcher(id)));
      retried.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") {
          results.push(outcome.value);
        } else {
          console.error(
            `[api/tmdb/library-summaries] Falha ao buscar resumo de ${label} ${retryIds[index]} (2 tentativas) — os demais não são afetados.`,
            outcome.reason
          );
        }
      });
    }
  }

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
