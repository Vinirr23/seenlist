import { describe, it, expect } from "vitest";
import { normalizeTitle } from "./titleNormalization";

describe("normalizeTitle", () => {
  it.each([
    ["Wrecked (2016)", "Wrecked", 2016],
    ["Alice in Borderland (2020)", "Alice in Borderland", 2020],
    ["Smallville (2001)", "Smallville", 2001],
  ])("extrai o ano de sufixo e limpa a query: %s", (input, expectedTitle, expectedYear) => {
    const result = normalizeTitle(input);
    expect(result.normalizedTitle).toBe(expectedTitle);
    expect(result.extractedYear).toBe(expectedYear);
  });

  it("preserva o título original intacto, mesmo depois de normalizar", () => {
    const result = normalizeTitle("Wrecked (2016)");
    expect(result.originalTitle).toBe("Wrecked (2016)");
  });

  it("não extrai ano quando não há nenhum no formato de sufixo", () => {
    const result = normalizeTitle("Breaking Bad");
    expect(result.normalizedTitle).toBe("Breaking Bad");
    expect(result.extractedYear).toBeNull();
  });

  it("não confunde um número que faz parte do próprio nome com um ano de sufixo", () => {
    const result = normalizeTitle("1883");
    expect(result.normalizedTitle).toBe("1883");
    expect(result.extractedYear).toBeNull();
  });

  it("não extrai um número implausível como ano (fora da faixa razoável)", () => {
    const result = normalizeTitle("Something (9999)");
    expect(result.extractedYear).toBeNull();
    expect(result.normalizedTitle).toBe("Something (9999)");
  });

  it("remove espaços duplicados", () => {
    const result = normalizeTitle("Grey's   Anatomy");
    expect(result.normalizedTitle).toBe("Grey's Anatomy");
  });

  it("normaliza travessão/hífen unicode para hífen comum", () => {
    const result = normalizeTitle("Marvel\u2019s Agents of S.H.I.E.L.D. \u2013 Season 1");
    expect(result.normalizedTitle).toContain("-");
    expect(result.normalizedTitle).not.toContain("\u2013");
  });

  it("normaliza aspas tipográficas para aspas retas", () => {
    const result = normalizeTitle("Grey\u2019s Anatomy");
    expect(result.normalizedTitle).toBe("Grey's Anatomy");
  });

  it("nunca lança exceção pra entrada vazia ou só espaço", () => {
    expect(() => normalizeTitle("")).not.toThrow();
    expect(() => normalizeTitle("   ")).not.toThrow();
  });
});
