import { describe, it, expect } from "vitest";
import { isShowAlreadyConsistent, type ExistingShowState } from "./idempotency";
import type { ParsedShow } from "../mapping/types";

function show(overrides: Partial<ParsedShow>): ParsedShow {
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

function existing(overrides: Partial<ExistingShowState>): ExistingShowState {
  return {
    hasStatus: true,
    status: "completed",
    nextSeason: null,
    nextEpisode: null,
    totalWatchEvents: 0,
    isFavorite: false,
    ...overrides,
  };
}

describe("isShowAlreadyConsistent", () => {
  it("sem nenhum registro anterior nunca é considerada consistente", () => {
    expect(isShowAlreadyConsistent(show({ totalWatchEvents: 62 }), undefined)).toBe(false);
  });

  it("completed, limpo (sem próximo episódio), episódios e favorito batendo → pula de verdade", () => {
    const result = isShowAlreadyConsistent(
      show({ totalWatchEvents: 62 }),
      existing({ status: "completed", totalWatchEvents: 62, nextSeason: null, nextEpisode: null })
    );
    expect(result).toBe(true);
  });

  it("TASK-027G — critério de aceite: série presa em 'watching' com episódios/favorito batendo NUNCA é considerada consistente, mesmo sem nada ter mudado no arquivo", () => {
    const result = isShowAlreadyConsistent(
      show({ totalWatchEvents: 62 }),
      existing({ status: "watching", totalWatchEvents: 62 })
    );
    expect(result).toBe(false);
  });

  it("mesma coisa pra want_to_watch — nunca pula sozinho", () => {
    const result = isShowAlreadyConsistent(
      show({ totalWatchEvents: 0 }),
      existing({ status: "want_to_watch", totalWatchEvents: 0 })
    );
    expect(result).toBe(false);
  });

  it("completed mas com next_episode/next_season sujos (inconsistente internamente) não pula", () => {
    const result = isShowAlreadyConsistent(
      show({ totalWatchEvents: 62 }),
      existing({ status: "completed", totalWatchEvents: 62, nextSeason: 6, nextEpisode: 1 })
    );
    expect(result).toBe(false);
  });

  it("progresso novo sempre reprocessa, mesmo já estando completed antes", () => {
    const result = isShowAlreadyConsistent(
      show({ totalWatchEvents: 70 }),
      existing({ status: "completed", totalWatchEvents: 62 })
    );
    expect(result).toBe(false);
  });

  it("mudança de favorito sempre reprocessa, mesmo com status completed limpo", () => {
    const result = isShowAlreadyConsistent(
      show({ totalWatchEvents: 62, isFavorite: true }),
      existing({ status: "completed", totalWatchEvents: 62, isFavorite: false })
    );
    expect(result).toBe(false);
  });
});
