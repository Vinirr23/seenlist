const JIKAN_BASE = "https://api.jikan.moe/v4";

/**
 * TASK-168 (correção 4, achado real via debug: "HTTP 504
 * Gateway Time-out") — a Jikan não só tem limite de requisições
 * (429), como também é conhecida por responder devagar/cair sob
 * carga (502/503/504) — problema de instabilidade do lado deles, não
 * do SeenList. 3 tentativas no total, com pausa crescente (a
 * primeira pausa curta cobre um pico passageiro de 429; a segunda,
 * mais longa, dá mais fôlego pra um 504 de verdade se recuperar).
 */
async function fetchJikan(path: string): Promise<{ response: Response | null; debugReason: string | null }> {
  const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
  const DELAYS_MS = [500, 1500];

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(`${JIKAN_BASE}${path}`, { next: { revalidate: 60 * 60 * 24 * 30 } });
      if (response.ok) return { response, debugReason: null };
      if (RETRYABLE_STATUSES.has(response.status) && attempt < DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]));
        continue;
      }
      console.error(`[jikan] Resposta ${response.status} em ${path}`);
      return { response: null, debugReason: `HTTP ${response.status} ${response.statusText}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[jikan] Exceção ao buscar ${path}`, error);
      return { response: null, debugReason: `Exceção: ${message}` };
    }
  }
  return { response: null, debugReason: "Esgotou as tentativas (instabilidade repetida do Jikan)." };
}

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

export interface JikanMatchDebugInfo {
  queryTitle: string;
  queryYear: number | null;
  candidates: { malId: number; title: string; titleEnglish: string | null; year: number | null; score: number }[];
  chosenMalId: number | null;
  /** TASK-168 — motivo exato de a busca ter falhado (status HTTP/exceção), quando `candidates` vem vazio por falha de rede, não por falta de correspondência. */
  debugReason: string | null;
}

/**
 * TASK-168 — versão de `findMalId` que também devolve os candidatos e
 * pontuações consideradas, pra dar pra ver de fora (via
 * `/api/anime/characters?debug=1`) por que bateu ou não bateu, sem
 * precisar abrir os logs do Vercel (o usuário não tem fácil acesso a
 * isso). `findMalId` (sem debug) continua existindo, chama esta por
 * baixo e descarta o detalhe — mesmo comportamento de antes pra quem
 * não pediu debug.
 */
export async function findMalIdWithDebug(title: string, year: number | null): Promise<JikanMatchDebugInfo> {
  const debug: JikanMatchDebugInfo = {
    queryTitle: title,
    queryYear: year,
    candidates: [],
    chosenMalId: null,
    debugReason: null,
  };

  const { response, debugReason } = await fetchJikan(`/anime?q=${encodeURIComponent(title)}&limit=5`);
  if (!response) {
    debug.debugReason = debugReason;
    return debug;
  }

  const body = (await response.json()) as { data?: JikanSearchResult[] };
  const candidates = body.data ?? [];
  if (candidates.length === 0) return debug;

  let best: { malId: number; score: number } | null = null;
  for (const candidate of candidates) {
    const scoreMain = tokenOverlapScore(title, candidate.title);
    const scoreEnglish = candidate.title_english ? tokenOverlapScore(title, candidate.title_english) : 0;
    let score = Math.max(scoreMain, scoreEnglish);
    if (year && candidate.year && Math.abs(year - candidate.year) <= 1) score += 0.15;
    debug.candidates.push({
      malId: candidate.mal_id,
      title: candidate.title,
      titleEnglish: candidate.title_english,
      year: candidate.year,
      score: Math.round(score * 1000) / 1000,
    });
    if (!best || score > best.score) best = { malId: candidate.mal_id, score };
  }

  if (best && best.score >= 0.5) debug.chosenMalId = best.malId;
  return debug;
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
  const debug = await findMalIdWithDebug(title, year);
  return debug.chosenMalId;
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
  const { response } = await fetchJikan(`/anime/${malId}/characters`);
  if (!response) return [];

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
