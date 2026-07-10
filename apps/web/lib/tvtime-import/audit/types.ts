import type { ReconstructionKind } from "../mapping/reconstructProgress";
import type { ResolvedStatus } from "../mapping/resolveStatus";

/** Um registro por série — construído durante runImport.ts, usado só para auditoria (item 5: "não mostrar ao usuário"). */
export interface AuditRecord {
  name: string;
  tmdbId: number | null;
  /** TASK-027J — episódios ÚNICOS esperados (min(totalWatchEvents, totalKnownEpisodes)) — conceito de BIBLIOTECA, nunca o bruto do GDPR. */
  expectedEpisodes: number;
  /** Episódios únicos realmente gravados em watched_episodes. */
  importedEpisodes: number;
  /** TASK-027J — valor bruto do GDPR (nb_episodes_seen), incluindo reassistidas — conceito de ESTATÍSTICA, nunca usado para decidir biblioteca/status. Guardado aqui só para auditoria conseguir mostrar os dois números lado a lado. */
  totalWatchEvents: number;
  status: ResolvedStatus | null;
  reconstructionKind: ReconstructionKind | null;
  confidence: number | null;
  isFavorite: boolean;
  favoriteImported: boolean;
}

export interface AuditDiscrepancy {
  series: string;
  expectedValue: string;
  foundValue: string;
  likelyReason: string;
}

export interface AuditReport {
  generatedAt: string;
  librarySeriesExpected: number;
  librarySeriesImported: number;
  /** TASK-027J — soma de episódios ÚNICOS esperados (min por série) — conceito de biblioteca. */
  episodesExpected: number;
  episodesImported: number;
  /** TASK-027J — soma do valor BRUTO do GDPR (inclui reassistidas) — conceito de estatística, deliberadamente diferente de episodesExpected quando há reassistida. */
  watchEventsExpected: number;
  favoritesExpected: number;
  favoritesImported: number;
  wantToWatchCount: number;
  completedCount: number;
  watchingCount: number;
  pendingReviewCount: number;
  averageConfidence: number;
  elapsedSeconds: number;
  discrepancies: AuditDiscrepancy[];
  records: AuditRecord[];
}
