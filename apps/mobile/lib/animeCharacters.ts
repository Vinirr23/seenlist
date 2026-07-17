const JIKAN_BASE = "https://api.jikan.moe/v4";

/**
 * TASK-168 (correção 4) — mesma ideia do web: a Jikan não só tem
 * limite de requisições (429), como também responde devagar/cai sob
 * carga (502/503/504) — problema do lado deles. 3 tentativas no
 * total, com pausa crescente.
 */
async function fetchJikan(path: string): Promise<Response | null> {
  const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
  const DELAYS_MS = [500, 1500];

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    const response = await fetch(`${JIKAN_BASE}${path}`);
    if (response.ok) return response;
    if (RETRYABLE_STATUSES.has(response.status) && attempt < DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]));
      continue;
    }
    console.error(`[animeCharacters] Resposta ${response.status} em ${path}`);
    return null;
  }
  return null;
}

export interface AnimeCharacter {
  id: number;
  name: string;
  imageUrl: string | null;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(tv\)|\(ova\)|\(movie\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared++;
  return shared / Math.max(tokensA.size, tokensB.size);
}

interface JikanSearchResult {
  mal_id: number;
  title: string;
  title_english: string | null;
  year: number | null;
}

/**
 * TASK-122 (personagem favorito) — porta de `lib/anime/jikan.ts`.
 * No web isso roda numa rota do site (com cache de 30 dias via
 * `next.revalidate`); aqui chama a Jikan direto do app — é uma API
 * pública, sem chave, então não precisa de servidor no meio. Sem
 * cache de 30 dias equivalente (RN não tem essa opção do Next.js) —
 * cada abertura de episódio busca de novo. Aceitável: é uma chamada
 * só, e a Jikan não exige autenticação nem tem custo por chamada.
 */
async function findMalId(title: string, year: number | null): Promise<number | null> {
  const response = await fetchJikan(`/anime?q=${encodeURIComponent(title)}&limit=5`);
  if (!response) return null;

  const body = (await response.json()) as { data?: JikanSearchResult[] };
  const candidates = body.data ?? [];
  if (candidates.length === 0) return null;

  let best: { malId: number; score: number } | null = null;
  for (const candidate of candidates) {
    const scoreMain = tokenOverlapScore(title, candidate.title);
    const scoreEnglish = candidate.title_english ? tokenOverlapScore(title, candidate.title_english) : 0;
    let score = Math.max(scoreMain, scoreEnglish);
    if (year && candidate.year && Math.abs(year - candidate.year) <= 1) score += 0.15;
    if (!best || score > best.score) best = { malId: candidate.mal_id, score };
  }

  if (!best || best.score < 0.5) return null;
  return best.malId;
}

interface JikanCharacterEntry {
  character: {
    mal_id: number;
    name: string;
    images?: { jpg?: { image_url?: string | null } };
  };
  role: string;
}

async function fetchCharactersByMalId(malId: number): Promise<AnimeCharacter[]> {
  const response = await fetchJikan(`/anime/${malId}/characters`);
  if (!response) return [];

  const body = (await response.json()) as { data?: JikanCharacterEntry[] };
  const entries = body.data ?? [];

  const main = entries.filter((entry) => entry.role === "Main");
  const source = main.length >= 3 ? main : entries;

  return source.slice(0, 12).map((entry) => ({
    id: entry.character.mal_id,
    name: entry.character.name,
    imageUrl: entry.character.images?.jpg?.image_url ?? null,
  }));
}

/** Idêntico a getAnimeCharacters do web — sem correspondência ou qualquer falha no meio do caminho, devolve lista vazia (nunca lança erro); quem chama trata isso como "usa o elenco do TMDB". */
export async function getAnimeCharacters(title: string, year: number | null): Promise<AnimeCharacter[]> {
  try {
    const malId = await findMalId(title, year);
    if (!malId) return [];
    return await fetchCharactersByMalId(malId);
  } catch (error) {
    console.error("[animeCharacters] Falha ao buscar personagens do anime", error);
    return [];
  }
}
