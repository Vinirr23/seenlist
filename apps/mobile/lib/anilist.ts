import type { AnimeCharacter } from "./animeCharacters";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

/** TASK-168 (fonte adicional) — porta de apps/web/lib/anime/anilist.ts. Ver comentário lá pro raciocínio completo (AniList é o próprio banco deles, sem scraping — mais estável que o Jikan). */

const SEARCH_QUERY = `
query ($search: String, $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(search: $search, type: ANIME) {
      id
      title {
        romaji
        english
      }
      startDate {
        year
      }
      characters(sort: ROLE, perPage: 12) {
        edges {
          role
          node {
            id
            name {
              full
            }
            image {
              large
            }
          }
        }
      }
    }
  }
}
`;

interface AniListCharacterEdge {
  role: string;
  node: {
    id: number;
    name: { full: string | null };
    image: { large: string | null } | null;
  };
}

interface AniListMedia {
  id: number;
  title: { romaji: string | null; english: string | null };
  startDate: { year: number | null } | null;
  characters: { edges: AniListCharacterEdge[] };
}

interface AniListResponse {
  data?: { Page?: { media?: AniListMedia[] } };
  errors?: { message: string }[];
}

/** TASK-174 (achado real, mesmo motivo do web — ver comentário completo em apps/web/lib/anime/anilist.ts) — palavras comuns em inglês/português não contam como sobreposição de verdade. */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "and",
  "or",
  "is",
  "it",
  "its",
  "for",
  "with",
  "this",
  "that",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "o",
  "os",
  "as",
]);

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
  const tokensA = new Set(normalizeTitle(a).split(" ").filter((token) => token && !STOPWORDS.has(token)));
  const tokensB = new Set(normalizeTitle(b).split(" ").filter((token) => token && !STOPWORDS.has(token)));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared++;
  return shared / Math.max(tokensA.size, tokensB.size);
}

export interface AniListResult {
  characters: AnimeCharacter[];
  searchFailed: boolean;
}

export async function getAniListCharacters(title: string, year: number | null): Promise<AniListResult> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: title, perPage: 5 } }),
    });
  } catch (error) {
    console.error("[anilist] Exceção ao buscar", error);
    return { characters: [], searchFailed: true };
  }

  if (!response.ok) {
    console.error(`[anilist] Resposta ${response.status}`);
    return { characters: [], searchFailed: true };
  }

  const body = (await response.json()) as AniListResponse;
  if (body.errors && body.errors.length > 0) {
    console.error("[anilist] Erros no GraphQL", body.errors);
    return { characters: [], searchFailed: true };
  }

  const candidates = body.data?.Page?.media ?? [];
  if (candidates.length === 0) return { characters: [], searchFailed: false };

  let best: { media: AniListMedia; score: number } | null = null;
  for (const media of candidates) {
    const scoreRomaji = media.title.romaji ? tokenOverlapScore(title, media.title.romaji) : 0;
    const scoreEnglish = media.title.english ? tokenOverlapScore(title, media.title.english) : 0;
    let score = Math.max(scoreRomaji, scoreEnglish);
    if (year && media.startDate?.year && Math.abs(year - media.startDate.year) <= 1) score += 0.15;
    if (!best || score > best.score) best = { media, score };
  }

  if (!best || best.score < 0.6) return { characters: [], searchFailed: false };

  const edges = best.media.characters.edges;
  const main = edges.filter((edge) => edge.role === "MAIN");
  const source = main.length >= 3 ? main : edges;

  return {
    characters: source.slice(0, 12).map((edge) => ({
      id: edge.node.id,
      name: edge.node.name.full ?? "?",
      imageUrl: edge.node.image?.large ?? null,
    })),
    searchFailed: false,
  };
}
