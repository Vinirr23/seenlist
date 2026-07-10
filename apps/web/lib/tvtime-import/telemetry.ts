import { createClient } from "@/lib/supabase/client";
import type { ImportSummary, ShowMatch } from "./mapping/types";

/**
 * TASK-027.5 — "registrar anonimamente... quais títulos geraram
 * dúvida". Nunca deve derrubar a importação se falhar — é
 * telemetria, não parte crítica do fluxo (por isso `catch` sem
 * `throw`, e chamado sem `await` bloqueante no call site).
 */
export async function logImportTelemetry(matches: ShowMatch[], summary: ImportSummary): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const ambiguousTitles = matches
      .filter((match) => match.status === "ambiguous" || match.status === "resolved" || match.status === "skipped")
      .map((match) => match.show.name);

    const { error } = await supabase.from("tvtime_import_events").insert({
      user_id: user.id,
      total_shows: matches.length,
      auto_matched_shows: matches.filter((match) => match.status === "matched").length,
      manually_resolved_shows: matches.filter((match) => match.status === "resolved").length,
      not_found_shows: summary.notFoundShows,
      imported_episodes: summary.importedEpisodes,
      elapsed_seconds: summary.elapsedSeconds,
      ambiguous_titles: ambiguousTitles,
    });

    if (error) {
      console.error("[tvtime-import] Falha ao registrar telemetria (não afeta a importação em si)", error);
    }
  } catch (error) {
    console.error("[tvtime-import] Falha ao registrar telemetria (não afeta a importação em si)", error);
  }
}
