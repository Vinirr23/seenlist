import { describe, it, expect } from "vitest";
import { buildAuditReport } from "./buildAuditReport";
import type { ParsedArchive } from "../mapping/types";
import type { AuditRecord } from "./types";

function archive(shows: ParsedArchive["shows"]): ParsedArchive {
  return { shows, favoriteCount: shows.filter((s) => s.isFavorite).length, missingFiles: [] };
}

function baseShow(overrides: Partial<ParsedArchive["shows"][number]>): ParsedArchive["shows"][number] {
  return {
    tvTimeId: "1",
    name: "Test",
    year: null,
    totalWatchEvents: 0,
    isFavorite: false,
    isExplicitlyForLater: false,
    knownEpisodes: [],
    ...overrides,
  };
}

function baseRecord(overrides: Partial<AuditRecord>): AuditRecord {
  return {
    name: "Test",
    tmdbId: 1,
    expectedEpisodes: 0,
    importedEpisodes: 0,
    totalWatchEvents: 0,
    status: "want_to_watch",
    reconstructionKind: "deterministic",
    confidence: 100,
    isFavorite: false,
    favoriteImported: false,
    ...overrides,
  };
}

describe("buildAuditReport", () => {
  it("critério de aceite: sem discrepância quando tudo bate exatamente", () => {
    const parsed = archive([baseShow({ name: "Breaking Bad", totalWatchEvents: 62 })]);
    const records = [
      baseRecord({
        name: "Breaking Bad",
        expectedEpisodes: 62,
        importedEpisodes: 62,
        totalWatchEvents: 62,
        status: "completed",
      }),
    ];
    const report = buildAuditReport(parsed, records, 10);
    expect(report.discrepancies).toHaveLength(0);
    expect(report.episodesExpected).toBe(report.episodesImported);
  });

  it("TASK-027J — série reassistida (watch events > episódios únicos) NUNCA gera discrepância", () => {
    const parsed = archive([baseShow({ name: "Lucifer", totalWatchEvents: 179 })]);
    const records = [
      baseRecord({
        name: "Lucifer",
        expectedEpisodes: 93,
        importedEpisodes: 93,
        totalWatchEvents: 179,
        status: "completed",
      }),
    ];
    const report = buildAuditReport(parsed, records, 10);
    expect(report.discrepancies).toHaveLength(0);
    expect(report.episodesExpected).toBe(93);
    expect(report.watchEventsExpected).toBe(179);
  });

  it("item 4: registra série, valor esperado, valor encontrado e motivo quando a gravação realmente falha", () => {
    const parsed = archive([baseShow({ name: "One Piece", totalWatchEvents: 1200 })]);
    const records = [
      baseRecord({
        name: "One Piece",
        expectedEpisodes: 1114,
        importedEpisodes: 1100,
        totalWatchEvents: 1200,
        status: "watching",
        confidence: 90,
      }),
    ];
    const report = buildAuditReport(parsed, records, 10);
    const discrepancy = report.discrepancies.find((d) => d.series === "One Piece");
    expect(discrepancy).toBeDefined();
    expect(discrepancy?.expectedValue).toContain("1114");
    expect(discrepancy?.foundValue).toContain("1100");
    expect(discrepancy?.likelyReason.length).toBeGreaterThan(0);
  });

  it("séries não encontradas no TMDB aparecem como discrepância, não somem do relatório", () => {
    const parsed = archive([baseShow({ name: "Série Obscura", totalWatchEvents: 5 })]);
    const records = [
      baseRecord({
        name: "Série Obscura",
        tmdbId: null,
        totalWatchEvents: 5,
        status: null,
        reconstructionKind: null,
        confidence: null,
      }),
    ];
    const report = buildAuditReport(parsed, records, 5);
    expect(report.discrepancies.some((d) => d.series === "Série Obscura")).toBe(true);
    expect(report.librarySeriesImported).toBe(0);
  });

  it("favorito esperado mas não gravado vira discrepância", () => {
    const parsed = archive([baseShow({ name: "Friends", isFavorite: true })]);
    const records = [baseRecord({ name: "Friends", isFavorite: true, favoriteImported: false })];
    const report = buildAuditReport(parsed, records, 3);
    expect(report.discrepancies.some((d) => d.series === "Friends")).toBe(true);
  });

  it("calcula confiança média corretamente", () => {
    const parsed = archive([baseShow({ name: "A" }), baseShow({ name: "B" })]);
    const records = [
      baseRecord({ name: "A", tmdbId: 1, confidence: 100 }),
      baseRecord({ name: "B", tmdbId: 2, confidence: 90 }),
    ];
    const report = buildAuditReport(parsed, records, 3);
    expect(report.averageConfidence).toBe(95);
  });
});
