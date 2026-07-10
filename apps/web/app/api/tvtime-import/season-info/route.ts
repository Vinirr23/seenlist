import { NextResponse } from "next/server";
import { getSeriesSeasonSummary, type SeriesSeasonSummary } from "@/lib/tmdb/client";

interface RequestBody {
  seriesIds: number[];
}

const MAX_IDS_PER_REQUEST = 10;

function sanitizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
    .slice(0, MAX_IDS_PER_REQUEST);
}

/**
 * TASK-027 (ajuste) — "comparar temporadas/episódios do histórico
 * contra cada candidato ambíguo". Só chamada quando o score já
 * deixou 2+ candidatos plausíveis (poucos casos, poucos ids por
 * chamada) — nunca pra toda série da importação, então não pesa no
 * "menos de 2 minutos".
 */
/**
 * TASK-027F — bug corrigido: antes usava Promise.all, que rejeita o
 * lote INTEIRO se UMA série falhar (rate limit/timeout do TMDB),
 * derrubando o resultado de até 9 outras séries que teriam
 * funcionado normalmente. Isso fazia `totalKnownEpisodes` virar
 * `null` pra elas em runImport.ts, e `resolveStatus` cai no
 * fallback "watching" mesmo quando a série está 100% assistida —
 * era a causa raiz de boa parte das séries "Concluída" errado.
 * Promise.allSettled isola cada série: uma falha vira só uma
 * ausência pontual no resultado, não derruba as demais.
 */
export async function POST(request: Request) {
  let body: Partial<RequestBody>;
  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch (error) {
    console.error("[api/tvtime-import/season-info] Corpo da requisição inválido.", error);
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const seriesIds = sanitizeIds(body.seriesIds);

  const settled = await Promise.allSettled(seriesIds.map((id) => getSeriesSeasonSummary(id).then((summary) => [id, summary] as const)));

  const result: Record<number, SeriesSeasonSummary> = {};
  const failedIds: number[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      const [id, summary] = outcome.value;
      result[id] = summary;
    } else {
      const failedId = seriesIds[index];
      if (failedId !== undefined) failedIds.push(failedId);
      console.error(`[api/tvtime-import/season-info] Falha ao buscar série ${failedId} no TMDB — as demais do lote não são afetadas.`, outcome.reason);
    }
  });

  return NextResponse.json({ results: result, failedIds });
}
