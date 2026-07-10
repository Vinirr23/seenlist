/**
 * TASK-027F — causa raiz encontrada: o TV Time frequentemente exporta
 * o nome da série como "Nome (Ano)" (ex.: "Wrecked (2016)"), e esse
 * texto INTEIRO ia direto pra query de busca enviada ao TMDB
 * (`cachedSeriesSearch` → `/api/search?q=...`). scoring.ts já tem uma
 * `normalizeName` que remove esse padrão — mas ela só entra em ação
 * DEPOIS que os resultados voltam do TMDB, pra comparar texto. O
 * problema estava antes disso: a busca em si nunca se beneficiava
 * dessa limpeza.
 *
 * Esta função existe só pra preparar a STRING DE BUSCA e extrair o
 * ano como dado estruturado (não descartá-lo como `normalizeName`
 * faz) — o ano vira critério de score via `rankCandidates`, nunca
 * volta a fazer parte do texto pesquisado.
 */
export interface NormalizedTitle {
  originalTitle: string;
  normalizedTitle: string;
  extractedYear: number | null;
}

const MIN_PLAUSIBLE_YEAR = 1900;
const MAX_PLAUSIBLE_YEAR = new Date().getFullYear() + 2; // margem pra séries anunciadas mas ainda não estreadas

/** "Wrecked (2016)" → { title: "Wrecked", year: 2016 }. Só remove o ano quando ele está no FINAL da string — não mexe em "1883" ou em algo como "Todos os Homens do Rei (1949)" se "(1949)" não fosse o padrão de sufixo, só nesse padrão específico de desambiguação que o TV Time usa. */
function extractTrailingYear(title: string): { title: string; year: number | null } {
  const match = title.match(/\s*\((\d{4})\)\s*$/);
  if (!match) return { title, year: null };

  const year = Number(match[1]);
  if (year < MIN_PLAUSIBLE_YEAR || year > MAX_PLAUSIBLE_YEAR) {
    return { title, year: null };
  }

  return { title: title.slice(0, match.index).trimEnd(), year };
}

/** Traços/hífens Unicode variados (‐ ‑ ‒ – — −) → hífen comum. */
function normalizeDashes(value: string): string {
  return value.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");
}

/** Aspas tipográficas (‘ ’ ‚ ‛ " " „ ‟) → aspas retas. */
function normalizeQuotes(value: string): string {
  return value.replace(/[\u2018\u2019\u201A\u201B\u02BC]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Ponto único de entrada — "acontece uma única vez e beneficia todas
 * as buscas do importador" (pedido explícito da tarefa). Não usa
 * remoção de acento como `normalizeName` faz: aqui o objetivo é
 * preparar uma STRING DE BUSCA legível pro TMDB, não uma chave de
 * comparação interna — remover acento da query mudaria o que é
 * efetivamente pesquisado (TMDB já lida bem com acento em busca).
 * `.normalize("NFC")` só garante representação Unicode consistente
 * (evita que o mesmo caractere visual, codificado de duas formas
 * diferentes, seja tratado como dois textos diferentes) — não apaga
 * nenhuma informação.
 */
export function normalizeTitle(rawTitle: string): NormalizedTitle {
  const originalTitle = rawTitle;

  let working = rawTitle.normalize("NFC");
  const { title: withoutYear, year } = extractTrailingYear(working);
  working = withoutYear;
  working = normalizeDashes(working);
  working = normalizeQuotes(working);
  working = collapseWhitespace(working);

  return { originalTitle, normalizedTitle: working, extractedYear: year };
}
