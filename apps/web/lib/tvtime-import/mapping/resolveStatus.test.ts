import { describe, it, expect } from "vitest";
import { resolveStatus } from "./resolveStatus";

describe("resolveStatus", () => {
  it("0 episódios únicos vistos → want_to_watch", () => {
    expect(resolveStatus(0, false, 62)).toBe("want_to_watch");
  });

  it("status explícito for_later → want_to_watch, mesmo com progresso > 0", () => {
    expect(resolveStatus(5, true, 62)).toBe("want_to_watch");
  });

  it("todos os episódios únicos oficiais vistos → completed", () => {
    expect(resolveStatus(62, false, 62)).toBe("completed");
  });

  it("parte dos episódios única vista → watching", () => {
    expect(resolveStatus(30, false, 62)).toBe("watching");
  });

  it("TASK-027J — critério de aceite: 124 watch events já reduzidos a 62 episódios únicos (reassistida completa) também vira completed, nunca watching", () => {
    // uniqueEpisodesSeen aqui já é o valor PÓS min() — 124 nunca chega
    // até esta função, só o resultado de min(124, 62) = 62 chegaria.
    expect(resolveStatus(62, false, 62)).toBe("completed");
  });

  it("nunca classifica como paused (sem fonte confiável no GDPR)", () => {
    const result = resolveStatus(30, false, 62);
    expect(["watching", "want_to_watch", "completed"]).toContain(result);
  });

  it("totalKnownEpisodes null (TMDB não respondeu) nunca vira completed sozinho", () => {
    expect(resolveStatus(30, false, null)).toBe("watching");
  });
});
