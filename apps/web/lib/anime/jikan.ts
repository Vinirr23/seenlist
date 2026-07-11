const JIKAN_BASE = "https://api.jikan.moe/v4";

export interface AnimeCharacter {
  id: number;
  name: string;
  imageUrl: string | null;
}

/**
 * TASK-067 (personagem favorito, versão 2) — normalização simples
 * pra comparar título do TMDB com título do Jikan/MyAnimeList: minúsculas,
 * sem acento, sem pontuação, sem sufixos comuns tipo "(TV)"/"2nd Season"
 * que um dos dois lados costuma ter e o outro não.
 */
function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos
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
 * Busca no Jikan pelo nome e tenta achar o anime certo — compara o
 * TMDB título (`title` e, se disponível, `originalTitle`) contra
 * `title`/`title_english` de cada resultado, com um bônus se o ano
 * bater. Limiar de 0.5: abaixo disso, prefere não achar nada a achar
 * o anime errado (melhor cair pro elenco do TMDB do que mostrar
 * personagem de outra série).
 */
async function findMalId(title: string, year: number | null): Promise<number | null> {
  const response = await fetch(`${JIKAN_BASE}/anime?q=${encodeURIComponent(title)}&limit=5`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok) return null;

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
  const response = await fetch(`${JIKAN_BASE}/anime/${malId}/characters`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok) return [];

  const body = (await response.json()) as { data?: JikanCharacterEntry[] };
  const entries = body.data ?? [];

  // Só "Main" — igual à referência do TV Time, que mostra o elenco principal, não figuração.
  const main = entries.filter((entry) => entry.role === "Main");
  const source = main.length >= 3 ? main : entries; // poucos "Main" catalogados (comum em animes menos populares) — usa todos nesse caso, melhor que ficar vazio

  return source.slice(0, 12).map((entry) => ({
    id: entry.character.mal_id,
    name: entry.character.name,
    imageUrl: entry.character.images?.jpg?.image_url ?? null,
  }));
}

/**
 * Ponto de entrada único: título (+ ano, se tiver) do TMDB entra,
 * lista de personagens (ou vazia) sai. Qualquer falha no meio do
 * caminho — sem correspondência, Jikan fora do ar, rate limit —
 * simplesmente devolve `[]`, nunca lança erro: quem chama
 * (`/api/anime/characters`) trata lista vazia como "usa o elenco do
 * TMDB", nunca como uma condição de erro.
 */
export async function getAnimeCharacters(title: string, year: number | null): Promise<AnimeCharacter[]> {
  try {
    const malId = await findMalId(title, year);
    if (!malId) return [];
    return await fetchCharactersByMalId(malId);
  } catch (error) {
    console.error("[jikan] Falha ao buscar personagens do anime", error);
    return [];
  }
}
