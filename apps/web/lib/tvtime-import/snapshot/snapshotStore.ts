import { createClient } from "@/lib/supabase/client";
import type { AuditReport } from "../audit/types";

export interface ImportSnapshot {
  importedAt: string;
  series: number;
  episodes: number;
  favorites: number;
  watchLater: number;
  completed: number;
  confidence: number;
  importType: "full" | "incremental";
}

/**
 * TASK-027D, item 3 — "não salvar o GDPR. Salvar apenas o resumo."
 * Só números agregados, nada do conteúdo do arquivo em si.
 */
export function buildSnapshot(report: AuditReport, importType: "full" | "incremental"): ImportSnapshot {
  return {
    importedAt: report.generatedAt,
    series: report.librarySeriesImported,
    episodes: report.episodesImported,
    favorites: report.favoritesImported,
    watchLater: report.wantToWatchCount,
    completed: report.completedCount,
    confidence: report.averageConfidence,
    importType,
  };
}

/**
 * Item 4 — "histórico interno de importações". `import_type` decide
 * se essa é a primeira importação do usuário ("full") ou uma
 * reimportação ("incremental") — determinado ANTES de salvar, vendo
 * se já existe algum snapshot anterior (ver determineImportType).
 */
export async function saveSnapshot(snapshot: ImportSnapshot): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("tvtime_import_snapshots").insert({
    user_id: user.id,
    imported_at: snapshot.importedAt,
    series_count: snapshot.series,
    episodes_count: snapshot.episodes,
    favorites_count: snapshot.favorites,
    want_to_watch_count: snapshot.watchLater,
    completed_count: snapshot.completed,
    pending_review_count: 0,
    confidence: snapshot.confidence,
    import_type: snapshot.importType,
  });

  if (error) {
    console.error("[tvtime-import] Falha ao salvar snapshot da importação (não afeta a importação em si)", error);
  }
}

export async function determineImportType(): Promise<"full" | "incremental"> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "full";

  const { count, error } = await supabase
    .from("tvtime_import_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) {
    console.error("[tvtime-import] Falha ao checar histórico de importação — assumindo 'full'", error);
    return "full";
  }

  return (count ?? 0) > 0 ? "incremental" : "full";
}

export interface ImportHistoryEntry extends ImportSnapshot {
  id: string;
}

export async function fetchImportHistory(): Promise<ImportHistoryEntry[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("tvtime_import_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("imported_at", { ascending: false });

  if (error) {
    console.error("[tvtime-import] Falha ao buscar histórico de importação", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    importedAt: row.imported_at,
    series: row.series_count,
    episodes: row.episodes_count,
    favorites: row.favorites_count,
    watchLater: row.want_to_watch_count,
    completed: row.completed_count,
    confidence: Number(row.confidence),
    importType: row.import_type,
  }));
}
