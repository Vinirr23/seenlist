import { describe, it, expect } from "vitest";
import { reconstructProgress, type SeasonSummary } from "./reconstructProgress";
import type { ParsedShow } from "./types";

function show(overrides: Partial<ParsedShow>): ParsedShow {
  return {
    tvTimeId: "test",
    name: "Test Show",
    year: null,
    totalWatchEvents: 0,
    isFavorite: false,
    isExplicitlyForLater: false,
    knownEpisodes: [],
    ...overrides,
  };
}

describe("reconstructProgress", () => {
  it("exemplo da tarefa (TASK-027B): Breaking Bad, 62/62 episódios → 100% de confiança, todos marcados", () => {
    const summary: SeasonSummary = {
      numberOfSeasons: 5,
      seasons: [
        { seasonNumber: 1, episodeCount: 7 },
        { seasonNumber: 2, episodeCount: 13 },
        { seasonNumber: 3, episodeCount: 13 },
        { seasonNumber: 4, episodeCount: 13 },
        { seasonNumber: 5, episodeCount: 16 },
      ],
    };
    const result = reconstructProgress(show({ totalWatchEvents: 62 }), summary);
    expect(result.episodes).toHaveLength(62);
    expect(result.uniqueEpisodesSeen).toBe(62);
    expect(result.confidence).toBe(100);
    expect(result.needsReview).toBe(false);
    expect(result.episodes.at(-1)).toEqual({ seasonNumber: 5, episodeNumber: 16 });
  });

  it("TASK-027J, critério de aceite central: Breaking Bad reassistido inteiro (124 watch events) continua 62/62 na biblioteca, Concluída", () => {
    const summary: SeasonSummary = {
      numberOfSeasons: 5,
      seasons: [
        { seasonNumber: 1, episodeCount: 7 },
        { seasonNumber: 2, episodeCount: 13 },
        { seasonNumber: 3, episodeCount: 13 },
        { seasonNumber: 4, episodeCount: 13 },
        { seasonNumber: 5, episodeCount: 16 },
      ],
    };
    const result = reconstructProgress(show({ totalWatchEvents: 124 }), summary);
    expect(result.episodes).toHaveLength(62);
    expect(result.uniqueEpisodesSeen).toBe(62);
    expect(result.needsReview).toBe(false);
    expect(result.kind).not.toBe("needs_review");
  });

  it("marca exatamente os N primeiros episódios em ordem cronológica, não em qualquer ordem", () => {
    const summary: SeasonSummary = {
      numberOfSeasons: 2,
      seasons: [
        { seasonNumber: 1, episodeCount: 10 },
        { seasonNumber: 2, episodeCount: 10 },
      ],
    };
    const result = reconstructProgress(show({ totalWatchEvents: 12 }), summary);
    expect(result.episodes).toHaveLength(12);
    expect(result.episodes[9]).toEqual({ seasonNumber: 1, episodeNumber: 10 });
    expect(result.episodes[10]).toEqual({ seasonNumber: 2, episodeNumber: 1 });
    expect(result.episodes[11]).toEqual({ seasonNumber: 2, episodeNumber: 2 });
  });

  it("exclui a temporada 0 (especiais) da ordem cronológica", () => {
    const summary: SeasonSummary = {
      numberOfSeasons: 1,
      seasons: [
        { seasonNumber: 0, episodeCount: 5 },
        { seasonNumber: 1, episodeCount: 10 },
      ],
    };
    const result = reconstructProgress(show({ totalWatchEvents: 3 }), summary);
    expect(result.episodes[0]).toEqual({ seasonNumber: 1, episodeNumber: 1 });
  });

  it("TASK-027J item 9 (via min(), não mais needs_review): nunca extrapola além do que o TMDB conhece", () => {
    const summary: SeasonSummary = { numberOfSeasons: 1, seasons: [{ seasonNumber: 1, episodeCount: 12 }] };
    const result = reconstructProgress(show({ totalWatchEvents: 5000 }), summary);
    expect(result.episodes).toHaveLength(12);
    expect(result.uniqueEpisodesSeen).toBe(12);
    expect(result.episodes.every((e) => e.seasonNumber === 1 && e.episodeNumber <= 12)).toBe(true);
    expect(result.needsReview).toBe(false);
  });

  it("série sem nenhuma temporada no TMDB vai para revisão quando havia progresso a reconstruir", () => {
    const result = reconstructProgress(show({ totalWatchEvents: 10 }), { numberOfSeasons: 0, seasons: [] });
    expect(result.needsReview).toBe(true);
    expect(result.uniqueEpisodesSeen).toBe(0);
  });

  it("série sem progresso e sem temporadas no TMDB não precisa de revisão (nada para reconstruir)", () => {
    const result = reconstructProgress(show({ totalWatchEvents: 0 }), { numberOfSeasons: 0, seasons: [] });
    expect(result.needsReview).toBe(false);
  });

  it("reduz a confiança quando um episódio granular conhecido cai fora da fatia reconstruída", () => {
    const summary: SeasonSummary = { numberOfSeasons: 1, seasons: [{ seasonNumber: 1, episodeCount: 20 }] };
    const consistent = reconstructProgress(
      show({ totalWatchEvents: 5, knownEpisodes: [{ seasonNumber: 1, episodeNumber: 3 }] }),
      summary
    );
    const contradicting = reconstructProgress(
      show({ totalWatchEvents: 5, knownEpisodes: [{ seasonNumber: 1, episodeNumber: 15 }] }),
      summary
    );
    expect(contradicting.confidence).toBeLessThan(consistent.confidence);
  });

  it("reconstrução limpa é 'deterministic'; com contradição vira 'partial'", () => {
    const summary: SeasonSummary = { numberOfSeasons: 1, seasons: [{ seasonNumber: 1, episodeCount: 20 }] };

    const clean = reconstructProgress(show({ totalWatchEvents: 5 }), summary);
    expect(clean.kind).toBe("deterministic");

    const contradicting = reconstructProgress(
      show({ totalWatchEvents: 5, knownEpisodes: [{ seasonNumber: 1, episodeNumber: 15 }] }),
      summary
    );
    expect(contradicting.kind).toBe("partial");
  });

  it("calcula o próximo episódio como o que vem logo após o último marcado", () => {
    const summary: SeasonSummary = {
      numberOfSeasons: 2,
      seasons: [
        { seasonNumber: 1, episodeCount: 10 },
        { seasonNumber: 2, episodeCount: 10 },
      ],
    };
    const result = reconstructProgress(show({ totalWatchEvents: 10 }), summary);
    expect(result.nextEpisode).toEqual({ seasonNumber: 2, episodeNumber: 1 });
  });

  it("próximo episódio é null quando a série está totalmente concluída (inclusive quando reassistida)", () => {
    const summary: SeasonSummary = { numberOfSeasons: 1, seasons: [{ seasonNumber: 1, episodeCount: 10 }] };
    const exact = reconstructProgress(show({ totalWatchEvents: 10 }), summary);
    expect(exact.nextEpisode).toBeNull();

    const rewatched = reconstructProgress(show({ totalWatchEvents: 30 }), summary);
    expect(rewatched.nextEpisode).toBeNull();
  });
});
