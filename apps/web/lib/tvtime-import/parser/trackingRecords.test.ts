import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTrackingFile, classifyType } from "./trackingRecords";

const showsCsv = readFileSync(join(__dirname, "../__fixtures__/tracking-prod-records-v2.csv"), "utf-8");
const moviesCsv = readFileSync(join(__dirname, "../__fixtures__/tracking-prod-records.csv"), "utf-8");

describe("parseTrackingFile — arquivo de séries", () => {
  it("descarta linhas sem título, sem quebrar o parsing das demais", () => {
    const result = parseTrackingFile(showsCsv, ["series_name"]);
    expect(result.discardedNoTitle).toBe(1);
    expect(result.records.length).toBe(result.totalRows - 1);
  });

  it("extrai episode_number e season_number corretamente", () => {
    const result = parseTrackingFile(showsCsv, ["series_name"]);
    const breakingBadEpisodes = result.records.filter((r) => r.title === "Breaking Bad");
    expect(breakingBadEpisodes).toHaveLength(3);
    expect(breakingBadEpisodes[0].episodeNumber).toBe(1);
    expect(breakingBadEpisodes[0].seasonNumber).toBe(1);
  });

  it("conta os valores de type encontrados, para o modo de diagnóstico", () => {
    const result = parseTrackingFile(showsCsv, ["series_name"]);
    expect(result.typeValueCounts.get("watch")).toBe(4);
    expect(result.typeValueCounts.get("follow")).toBe(1);
    expect(result.typeValueCounts.get("favorite")).toBe(1);
  });
});

describe("parseTrackingFile — arquivo de filmes", () => {
  it("extrai movie_name e type corretamente", () => {
    const result = parseTrackingFile(moviesCsv, ["movie_name"]);
    expect(result.records).toHaveLength(3);
    expect(result.records.map((r) => r.title)).toContain("Inception");
  });
});

describe("classifyType", () => {
  it("reconhece variações de 'assistido'", () => {
    expect(classifyType("watch", true)).toBe("watched");
    expect(classifyType("watched", true)).toBe("watched");
    expect(classifyType("seen", true)).toBe("watched");
  });

  it("reconhece favoritos e listas", () => {
    expect(classifyType("favorite", true)).toBe("favorite");
    expect(classifyType("list_add", true)).toBe("list");
  });

  it("trata ausência de coluna type como assistido por padrão", () => {
    expect(classifyType(null, false)).toBe("watched");
  });

  it("trata coluna type presente mas vazia como desconhecido, não como assistido", () => {
    expect(classifyType(null, true)).toBe("unknown");
  });

  it("nunca lança exceção para um valor de type desconhecido", () => {
    expect(() => classifyType("some_future_event_type", true)).not.toThrow();
    expect(classifyType("some_future_event_type", true)).toBe("unknown");
  });
});
