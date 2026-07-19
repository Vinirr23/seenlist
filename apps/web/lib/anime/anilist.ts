import type { AnimeCharacter } from "./jikan";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

/**
 * TASK-168 (fonte adicional, a pedido — "tem outra fonte além do
 * Jikan?") — o AniList expõe o próprio banco de dados deles direto
 * via GraphQL, sem intermediário fazendo scraping (diferente do
 * Jikan, que faz scraping do site do MyAnimeList — por isso a
 * instabilidade que já vimos, 504 repetido). Mesma ideia de
 * matching (comparar título, com bônus de ano), só que busca +
 * personagens vêm numa chamada só (o Jikan precisa de duas: busca,
 * depois personagens por ID).
 */

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

/**
 * TASK-174 (achado real — falso positivo: "A Casa do Dragão" /
 * "House of the Dragon", série live-action, mostrando personagem de
 * anime nenhum a ver) — palavras comuns em inglês ("the", "of", "a",
 * "in"...) contavam como sobreposição "de verdade" no cálculo de
 * pontuação. Título como "House of the Dragon" tem 4 palavras, mas
 * só 2 delas ("house", "dragon") dizem alguma coisa — "of"/"the" são
 * só gramática. Um anime batendo só nessas duas palavras-função já
 * inflava a pontuação o bastante pra passar do limiar. Filtra essas
 * palavras fora do cálculo — só o que sobra depois de tirar
 * "the"/"of"/"a" etc. conta como sobreposição de verdade.
 */
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

/**
 * Ponto de entrada — mesma assinatura de `getAnimeCharacters` do
 * Jikan, pra dar pra tentar um e cair pro outro sem código
 * duplicado em quem chama. `searchFailed: true` só quando a
 * requisição em si falhou (rede/GraphQL fora do ar) — rodou
 * certinho e não achou nada (não é anime) é `searchFailed: false`,
 * `characters: []`.
 */
export interface AniListDebugInfo {
  queryTitle: string;
  queryYear: number | null;
  httpStatus: number | null;
  graphqlErrors: string[] | null;
  candidates: { id: number; romaji: string | null; english: string | null; year: number | null; score: number }[];
  chosenId: number | null;
}

/**
 * TASK-168 (correção 6) — versão com debug de `getAniListCharacters`,
 * pra dar pra ver de fora (via `/api/anime/characters?debug=1`)
 * exatamente o que o AniList considerou — o AniList virou a primeira
 * tentativa, então o debug antigo (só do Jikan) não mostrava mais o
 * que importava.
 */
export async function getAniListCharactersWithDebug(title: string, year: number | null): Promise<AniListDebugInfo> {
  const debug: AniListDebugInfo = {
    queryTitle: title,
    queryYear: year,
    httpStatus: null,
    graphqlErrors: null,
    candidates: [],
    chosenId: null,
  };

  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: title, perPage: 5 } }),
      cache: "no-store",
    });
  } catch (error) {
    debug.graphqlErrors = [error instanceof Error ? error.message : String(error)];
    return debug;
  }

  debug.httpStatus = response.status;
  if (!response.ok) return debug;

  const body = (await response.json()) as AniListResponse;
  if (body.errors && body.errors.length > 0) {
    debug.graphqlErrors = body.errors.map((e) => e.message);
    return debug;
  }

  const candidates = body.data?.Page?.media ?? [];
  let best: { media: AniListMedia; score: number } | null = null;
  for (const media of candidates) {
    const scoreRomaji = media.title.romaji ? tokenOverlapScore(title, media.title.romaji) : 0;
    const scoreEnglish = media.title.english ? tokenOverlapScore(title, media.title.english) : 0;
    let score = Math.max(scoreRomaji, scoreEnglish);
    if (year && media.startDate?.year && Math.abs(year - media.startDate.year) <= 1) score += 0.05;
    debug.candidates.push({
      id: media.id,
      romaji: media.title.romaji,
      english: media.title.english,
      year: media.startDate?.year ?? null,
      score: Math.round(score * 1000) / 1000,
    });
    if (!best || score > best.score) best = { media, score };
  }

  if (best && best.score >= 0.7) debug.chosenId = best.media.id;
  return debug;
}

export async function getAniListCharacters(title: string, year: number | null): Promise<AniListResult> {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: title, perPage: 5 } }),
      // TASK-174 (achado real — resultado errado de antes da
      // correção continuava aparecendo mesmo em aba anônima, o que
      // só faz sentido se o cache fosse do SERVIDOR, não do
      // navegador) — `cache: "no-store"` explícito aqui, sem
      // depender do comportamento padrão do Next.js pra `fetch`
      // dentro de Route Handler, que pode variar/confundir.
      cache: "no-store",
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
    if (year && media.startDate?.year && Math.abs(year - media.startDate.year) <= 1) score += 0.05;
    if (!best || score > best.score) best = { media, score };
  }

  if (!best || best.score < 0.7) return { characters: [], searchFailed: false };

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
