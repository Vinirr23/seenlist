/**
 * Ajuste — "o algoritmo deve funcionar por score", não por regras
 * rígidas ("se só tiver 1 resultado, aceita; senão pergunta"). A
 * versão anterior jogava quase tudo pra seleção manual porque exigia
 * quase uma coincidência perfeita. Esta calcula uma pontuação 0-100
 * combinando nome + ano, e só pede ajuda quando a pontuação do
 * melhor resultado não é claramente boa o suficiente.
 */

/** Remove acento, pontuação, "(US)"/"(UK)"/ano entre parênteses, e artigo inicial — pra "Smallville" e "smallville" (ou "The Office (US)" e "the office") caírem na mesma forma. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos
    .toLowerCase()
    .replace(/\(\s*(us|uk|br|de|fr|es|ca|au|\d{4})\s*\)/gi, " ") // (US), (UK), (2001)...
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // pontuação
    .replace(/^(the|a|an)\s+/, "") // artigo inicial em inglês
    .replace(/\s+/g, " ")
    .trim();
}

/** Coeficiente de Dice sobre palavras — simples, sem dependência nova, robusto o bastante pra título de série. */
function wordOverlapSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const wordsA = a.split(" ").filter(Boolean);
  const wordsB = b.split(" ").filter(Boolean);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setB = new Set(wordsB);
  const intersection = wordsA.filter((word) => setB.has(word)).length;
  return (2 * intersection) / (wordsA.length + wordsB.length);
}

export interface ScoringCandidate {
  tmdbId: number;
  title: string;
  /** original_name/original_title do TMDB — TV Time costuma guardar o nome original, não o localizado (ex.: "Sons of Anarchy", não "Filhos da Anarquia"). Comparar só com `title` sub-pontuava resultados corretos sempre que o TMDB devolve título traduzido. */
  originalTitle: string | null;
  year: number | null;
  popularity: number;
}

export interface ScoredCandidate extends ScoringCandidate {
  score: number;
}

const YEAR_TOLERANCE = 1;

/** Pontua contra um único título (localizado OU original) — usado por scoreCandidate pra pegar o melhor dos dois. */
function scoreAgainstTitle(normalizedQuery: string, title: string): number {
  const normalizedTitle = normalizeName(title);

  if (normalizedQuery === normalizedTitle) return 65;

  let score = wordOverlapSimilarity(normalizedQuery, normalizedTitle) * 50;
  const extraWords = Math.max(0, normalizedTitle.split(" ").length - normalizedQuery.split(" ").length);
  score -= extraWords * 4;
  return score;
}

/**
 * Pesos: nome pesa mais que ano (nome é o dado mais confiável vindo
 * do TV Time); ano é usado pra reforçar ou penalizar, não como
 * critério isolado. Popularidade NUNCA entra na pontuação em si —
 * só desempata quando dois scores ficam praticamente iguais (pedido
 * explícito: "usar apenas como critério de desempate").
 *
 * Ajuste (Regra 3): compara com `title` (localizado) E `originalTitle`
 * (original), usando o MAIOR dos dois — "Sons of Anarchy" bate 100%
 * contra o original mesmo o TMDB devolvendo "Filhos da Anarquia"
 * como título de exibição. Sem isso, toda série com título traduzido
 * caía artificialmente pra seleção manual mesmo sendo a única opção
 * e claramente correta.
 */
export function scoreCandidate(queryName: string, queryYear: number | null, candidate: ScoringCandidate): number {
  const normalizedQuery = normalizeName(queryName);

  const titleScore = scoreAgainstTitle(normalizedQuery, candidate.title);
  const originalScore = candidate.originalTitle ? scoreAgainstTitle(normalizedQuery, candidate.originalTitle) : -1;
  let score = Math.max(titleScore, originalScore);

  if (queryYear && candidate.year) {
    const diff = Math.abs(queryYear - candidate.year);
    if (diff <= YEAR_TOLERANCE) score += 30;
    else if (diff <= 3) score += 5; // ano "na vizinhança" ainda soma um pouco (remakes, datas imprecisas do TV Time)
    else score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Ordena por score; em empate técnico (diferença ≤ 3 pontos),
 * desempata por popularidade — é exatamente o papel que o item 1
 * pede pra popularidade ter, nada além disso.
 */
export function rankCandidates(
  queryName: string,
  queryYear: number | null,
  candidates: ScoringCandidate[]
): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreCandidate(queryName, queryYear, candidate) }))
    .sort((a, b) => {
      if (Math.abs(a.score - b.score) <= 3) return b.popularity - a.popularity;
      return b.score - a.score;
    });
}
