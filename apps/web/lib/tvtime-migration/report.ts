import type { MatchResult, DiscardedSeries } from "./types";

export interface MigrationReportRow {
  uuid: string;
  title: string;
  csv_status: string;
  matching: MatchResult;
  tmdb: { title: string | null; ended: boolean | null } | null;
  episodes_reconstructed: {
    main_watched: number;
    main_total_in_file: number;
    specials_watched: number;
    specials_pending_confirmation: number;
    specials_pending_list: { seasonNumber: number; episodeNumber: number }[];
  } | null;
  final_category: string | null;
  category_reason: string | null;
  needs_confirmation: boolean;
  persisted: boolean;
  persistence_note: string | null;
}

export interface MovieReportRow {
  uuid: string;
  title: string;
  csv_is_watched: boolean;
  matching: MatchResult;
  tmdb: { title: string | null } | null;
  final_status: string | null;
  status_reason: string | null;
  needs_confirmation: boolean;
  persisted: boolean;
  persistence_note: string | null;
}

export interface MigrationReport {
  generated_at: string;
  total_series_in_file: number;
  imported: number;
  discarded: DiscardedSeries[];
  pending_confirmation: number;
  rows: MigrationReportRow[];
  total_movies_in_file: number;
  movies_imported: number;
  movies_discarded: DiscardedSeries[];
  movies_pending_confirmation: number;
  movie_rows: MovieReportRow[];
}

export function downloadMigrationReport(report: MigrationReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "migration-report.json";
  link.click();
  URL.revokeObjectURL(url);
}
