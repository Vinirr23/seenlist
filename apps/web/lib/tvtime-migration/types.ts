export type MatchTier =
  | "tvdb_id"
  | "imdb_id"
  | "name_year"
  | "name_episode_count"
  | "name_only"
  | "ambiguous"
  | "not_found";

export interface MatchCandidate {
  tmdbId: number;
  title: string;
  year: number | null;
  numberOfSeasons: number | null;
  totalEpisodes: number | null;
}

export interface MatchResult {
  seriesUuid: string;
  tmdbId: number | null;
  tier: MatchTier;
  needsConfirmation: boolean;
  candidates: MatchCandidate[];
}

export type SeenListCategory = "watching" | "want_to_watch" | "paused" | "up_to_date" | "completed";

export interface CategoryResult {
  category: SeenListCategory;
  reason: string;
}

export interface DiscardedSeries {
  uuid: string;
  title: string;
  reason: string;
}
