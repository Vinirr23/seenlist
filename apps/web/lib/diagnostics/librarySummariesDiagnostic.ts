import { createClient } from "@/lib/supabase/client";
import { fetchLibraryItems } from "@/lib/queries/library-state";

export interface LibrarySummariesDiagnosticReport {
  generated_at: string;
  batch: {
    ids_received: number;
    ids_after_production_slicing: number;
    ids_dropped_by_slicing_count: number;
    ids_dropped_by_slicing: number[];
    requests_started: number;
    http_200: number;
    http_404: number;
    http_429: number;
    http_500: number;
    other_http: number;
    timeouts: number;
    exceptions: number;
    batch_duration_ms: number;
    average_request_duration_ms: number;
    poster_present: number;
    poster_absent: number;
    promise_rejections_caught: { tmdb_id: number | null; reason: string }[];
  };
  library_comparison: {
    inserted_in_library: number;
    discarded_after_tmdb_success: number;
  };
  rows: {
    tmdb_id: number;
    http_status: number | null;
    outcome: string;
    exception_message: string | null;
    duration_ms: number;
    title: string | null;
    poster_path: string | null;
    has_poster_path: boolean;
    inserted_in_library: boolean;
    discard_reason: string | null;
  }[];
}

/**
 * TASK-037 — "Diagnóstico do carregamento de capas". Reproduz a
 * MESMA chamada que a Biblioteca faz de verdade — mesmo conjunto de
 * IDs (todo `series_status` do usuário, sem filtrar nada, do jeito
 * que `fetchLibraryItems` monta `validSeriesIds`) — pra rota
 * instrumentada, que replica o corte de 100 já existente na
 * produção, sem alterá-lo. Depois compara com o resultado REAL da
 * Biblioteca (`fetchLibraryItems()` de verdade) pra ver quais IDs
 * que o TMDB confirmou com poster acabaram não aparecendo.
 */
export async function runLibrarySummariesDiagnostic(): Promise<LibrarySummariesDiagnosticReport> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  // Mesmo conjunto que library-state.ts monta — todo series_status não removido, mais os que só têm watched_episodes.
  const [seriesStatusResult, watchedEpisodesResult] = await Promise.all([
    supabase.from("series_status").select("series_id, status").eq("user_id", user.id),
    supabase.from("watched_episodes").select("series_id").eq("user_id", user.id).eq("is_special", false),
  ]);

  const validSeriesIds = new Set<number>();
  for (const row of seriesStatusResult.data ?? []) {
    if (row.status !== "removed") validSeriesIds.add(row.series_id as number);
  }
  for (const row of watchedEpisodesResult.data ?? []) {
    validSeriesIds.add(row.series_id as number);
  }
  for (const row of seriesStatusResult.data ?? []) {
    if (row.status === "removed") validSeriesIds.delete(row.series_id as number);
  }

  const idsReceived = [...validSeriesIds];

  const response = await fetch("/api/diagnostics/library-summaries-instrumented", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesIds: idsReceived }),
  });
  if (!response.ok) {
    throw new Error(`Rota instrumentada respondeu ${response.status}`);
  }
  const batchData = await response.json();

  // Resultado REAL da Biblioteca, pra comparar.
  const libraryItems = await fetchLibraryItems();
  const libraryPosterById = new Map(
    libraryItems.filter((i) => i.mediaType === "series").map((i) => [i.id, i.posterPath])
  );

  const rows = (batchData.results as {
    tmdb_id: number;
    http_status: number | null;
    outcome: string;
    exception_message: string | null;
    duration_ms: number;
    title: string | null;
    poster_path: string | null;
    has_poster_path: boolean;
  }[]).map((r) => {
    const libraryPoster = libraryPosterById.get(r.tmdb_id);
    const insertedInLibrary = libraryPoster !== undefined && libraryPoster !== null;
    let discardReason: string | null = null;
    if (r.has_poster_path && !insertedInLibrary) {
      discardReason = libraryPoster === undefined
        ? "tmdb_id nem aparece no resultado de fetchLibraryItems() — provavelmente descartado pelo corte de MAX_IDS_PER_REQUEST antes de chegar à Biblioteca de verdade."
        : "tmdb_id aparece na Biblioteca, mas com posterPath nulo — resumo não chegou ou não foi aplicado corretamente em buildLibraryItemsFromRows.";
    }
    return {
      tmdb_id: r.tmdb_id,
      http_status: r.http_status,
      outcome: r.outcome,
      exception_message: r.exception_message,
      duration_ms: r.duration_ms,
      title: r.title,
      poster_path: r.poster_path,
      has_poster_path: r.has_poster_path,
      inserted_in_library: insertedInLibrary,
      discard_reason: discardReason,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    batch: {
      ids_received: batchData.ids_received,
      ids_after_production_slicing: batchData.ids_after_production_slicing,
      ids_dropped_by_slicing_count: batchData.ids_dropped_by_slicing_count,
      ids_dropped_by_slicing: batchData.ids_dropped_by_slicing,
      requests_started: batchData.requests_started,
      http_200: batchData.counts.http_200,
      http_404: batchData.counts.http_404,
      http_429: batchData.counts.http_429,
      http_500: batchData.counts.http_500,
      other_http: batchData.counts.other_http,
      timeouts: batchData.counts.timeouts,
      exceptions: batchData.counts.exceptions,
      batch_duration_ms: batchData.batch_duration_ms,
      average_request_duration_ms: batchData.average_request_duration_ms,
      poster_present: batchData.poster_present,
      poster_absent: batchData.poster_absent,
      promise_rejections_caught: batchData.promise_rejections_caught,
    },
    library_comparison: {
      inserted_in_library: rows.filter((r) => r.inserted_in_library).length,
      discarded_after_tmdb_success: rows.filter((r) => r.has_poster_path && !r.inserted_in_library).length,
    },
    rows,
  };
}

export function downloadLibrarySummariesDiagnostic(report: LibrarySummariesDiagnosticReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `library-summaries-diagnostic-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
