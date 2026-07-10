import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
/** Mesmo valor de MAX_IDS_PER_REQUEST em api/tmdb/library-summaries/route.ts — reproduzido aqui de propósito, pra provar o comportamento REAL, não uma versão idealizada. */
const PRODUCTION_MAX_IDS_PER_REQUEST = 100;
const REQUEST_TIMEOUT_MS = 8000;

interface RequestBody {
  seriesIds: number[];
}

interface PerRequestResult {
  tmdb_id: number;
  http_status: number | null;
  outcome: "200" | "404" | "429" | "500" | "other_http" | "timeout" | "exception";
  exception_message: string | null;
  duration_ms: number;
  title: string | null;
  poster_path: string | null;
  has_poster_path: boolean;
}

/**
 * TASK-037 — instrumentação real, sem alterar `library-summaries`
 * nem `fetchLibraryItems`. Reproduz o MESMO corte de
 * `MAX_IDS_PER_REQUEST=100` que a rota de produção já faz (via
 * `sanitizeIds`) — isso é INTENCIONAL: o objetivo é provar o que
 * acontece na produção de verdade, não testar uma versão sem o
 * corte. `fetch()` cru direto ao TMDB (não usa `tmdbGet`, que tem
 * `next: { revalidate: 300 }` — cache do Next que poderia mascarar
 * se a chamada é realmente nova ou vem de um cache anterior).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RequestBody>;
  const idsReceived = Array.isArray(body.seriesIds) ? body.seriesIds.filter((id) => typeof id === "number") : [];

  const idsAfterProductionSlicing = idsReceived.slice(0, PRODUCTION_MAX_IDS_PER_REQUEST);
  const idsDroppedBySlicing = idsReceived.slice(PRODUCTION_MAX_IDS_PER_REQUEST);

  const batchStart = Date.now();

  const settled = await Promise.allSettled(
    idsAfterProductionSlicing.map(async (id): Promise<PerRequestResult> => {
      const requestStart = Date.now();
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const url = new URL(`${TMDB_BASE_URL}/tv/${id}`);
        url.searchParams.set("api_key", env.tmdbApiKey());
        url.searchParams.set("language", "pt-BR");

        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        clearTimeout(timeoutHandle);
        const duration = Date.now() - requestStart;

        if (response.status === 200) {
          const data = (await response.json()) as { name?: string; poster_path?: string | null };
          return {
            tmdb_id: id,
            http_status: 200,
            outcome: "200",
            exception_message: null,
            duration_ms: duration,
            title: data.name ?? null,
            poster_path: data.poster_path ?? null,
            has_poster_path: Boolean(data.poster_path),
          };
        }

        const outcome =
          response.status === 404
            ? "404"
            : response.status === 429
              ? "429"
              : response.status === 500
                ? "500"
                : "other_http";
        return {
          tmdb_id: id,
          http_status: response.status,
          outcome,
          exception_message: null,
          duration_ms: duration,
          title: null,
          poster_path: null,
          has_poster_path: false,
        };
      } catch (error) {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - requestStart;
        const isAbort = error instanceof Error && error.name === "AbortError";
        return {
          tmdb_id: id,
          http_status: null,
          outcome: isAbort ? "timeout" : "exception",
          exception_message: error instanceof Error ? error.message : String(error),
          duration_ms: duration,
          title: null,
          poster_path: null,
          has_poster_path: false,
        };
      }
    })
  );

  const results: PerRequestResult[] = [];
  const promiseRejections: { tmdb_id: number | null; reason: string }[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      promiseRejections.push({
        tmdb_id: idsAfterProductionSlicing[index] ?? null,
        reason: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  });

  const batchDurationMs = Date.now() - batchStart;

  const counts = {
    http_200: results.filter((r) => r.outcome === "200").length,
    http_404: results.filter((r) => r.outcome === "404").length,
    http_429: results.filter((r) => r.outcome === "429").length,
    http_500: results.filter((r) => r.outcome === "500").length,
    other_http: results.filter((r) => r.outcome === "other_http").length,
    timeouts: results.filter((r) => r.outcome === "timeout").length,
    exceptions: results.filter((r) => r.outcome === "exception").length + promiseRejections.length,
  };

  return NextResponse.json({
    ids_received: idsReceived.length,
    ids_after_production_slicing: idsAfterProductionSlicing.length,
    ids_dropped_by_slicing: idsDroppedBySlicing,
    ids_dropped_by_slicing_count: idsDroppedBySlicing.length,
    requests_started: idsAfterProductionSlicing.length,
    batch_duration_ms: batchDurationMs,
    average_request_duration_ms:
      results.length > 0 ? results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length : 0,
    counts,
    poster_present: results.filter((r) => r.has_poster_path).length,
    poster_absent: results.filter((r) => r.outcome === "200" && !r.has_poster_path).length,
    promise_rejections_caught: promiseRejections,
    results,
  });
}
