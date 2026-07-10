import Papa from "papaparse";

/**
 * TASK-027 — aviso importante que vale pra este arquivo inteiro e
 * pros parsers em `parser/*.ts`: eu nunca vi um arquivo GDPR real do
 * TV Time. Os nomes de coluna usados nos parsers são a melhor
 * suposição possível a partir dos nomes de arquivo que a tarefa deu,
 * não uma confirmação de formato. Por isso este parser normaliza
 * cabeçalhos (minúsculo, sem espaço/underscore/hífen) antes de
 * comparar — aumenta a chance de casar variações como "TV Show ID",
 * "tv_show_id", "tvShowId" sem precisar saber qual delas o TV Time
 * realmente usa. Quando testado contra um arquivo de verdade, os
 * nomes em `COLUMN_ALIASES` de cada parser são o primeiro lugar pra
 * ajustar.
 */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export interface ParsedCsv {
  rows: Record<string, string>[];
  /** Cabeçalhos normalizados detectados no arquivo — usado só para diagnóstico quando o parsing de uma linha falha silenciosamente por não achar a coluna esperada. */
  headers: string[];
}

export function parseCsv(content: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });
  return { rows: result.data, headers: result.meta.fields ?? [] };
}

/** Pega o primeiro valor não-vazio entre vários nomes de coluna possíveis pro mesmo campo. */
export function firstColumn(row: Record<string, string>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export function toNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
