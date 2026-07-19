import { getAniListCharacters } from "./anilist";

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
      // TASK-168 (correção 7) — sem cache de servidor aqui, mesmo
      // raciocínio do AniList (`anilist.ts`) — o cache do lado do
      // cliente (React Query) já cobre isso, condicionado a
      // `searchFailed`, sem risco de guardar uma resposta ruim por
      // 30 dias.
      const response = await fetch(`${JIKAN_BASE}${path}`);
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
/** TASK-174 (achado real, mesmo motivo do AniList — ver comentário completo em lib/anime/anilist.ts) — palavras comuns em inglês/português não contam como sobreposição de verdade. */
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
    .replace(/[\u0300-\u036f]/g, "") // acentos
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
 * TASK-168 — versão de `findMalId` (removida, sem uso depois desta
 * reestruturação) que também devolve os candidatos e pontuações
 * consideradas, pra dar pra ver de fora (via
 * `/api/anime/characters?debug=1`) por que bateu ou não bateu, sem
 * precisar abrir os logs do Vercel (o usuário não tem fácil acesso a
 * isso). `getAnimeCharacters` chama esta diretamente agora, não mais
 * através de um wrapper simples — precisa do `debugReason` pra saber
 * se foi "busca falhou" (`searchFailed: true`) ou "buscou certinho,
 * não achou" (`searchFailed: false`).
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

  if (best && best.score >= 0.6) debug.chosenMalId = best.malId;
  return debug;
}

/**
 * Busca no Jikan pelo nome e tenta achar o anime certo — compara o
 * TMDB título (`title` e, se disponível, `originalTitle`) contra
 * `title`/`title_english` de cada resultado, com um bônus se o ano
 * bater. Limiar de 0.6 (achado real, TASK-174: 0.5 deixava passar
 * falso positivo tipo "House of the Dragon" batendo com anime que
 * só compartilha palavra comum) — abaixo disso, prefere não achar
 * nada a achar o anime errado (melhor cair pro elenco do TMDB do que
 * mostrar personagem de outra série).
 */
interface JikanCharacterEntry {
  character: {
    mal_id: number;
    name: string;
    images?: { jpg?: { image_url?: string | null } };
  };
  role: string;
}

/** `failed: true` quando a chamada em si não deu (rede/instabilidade) — diferente de "achou o anime mas API de personagens devolveu vazio", que também vira `[]` mas com `failed: false`. */
async function fetchCharactersByMalId(malId: number): Promise<{ characters: AnimeCharacter[]; failed: boolean }> {
  const { response } = await fetchJikan(`/anime/${malId}/characters`);
  if (!response) return { characters: [], failed: true };

  const body = (await response.json()) as { data?: JikanCharacterEntry[] };
  const entries = body.data ?? [];

  // Só "Main" — igual à referência do TV Time, que mostra o elenco principal, não figuração.
  const main = entries.filter((entry) => entry.role === "Main");
  const source = main.length >= 3 ? main : entries; // poucos "Main" catalogados (comum em animes menos populares) — usa todos nesse caso, melhor que ficar vazio

  return {
    characters: source.slice(0, 12).map((entry) => ({
      id: entry.character.mal_id,
      name: entry.character.name,
      imageUrl: entry.character.images?.jpg?.image_url ?? null,
    })),
    failed: false,
  };
}

export interface AnimeCharactersResult {
  characters: AnimeCharacter[];
  /**
   * TASK-168 (correção 5, a pedido — plano B) — `true` quando a
   * busca em si FALHOU (rede/instabilidade da Jikan, ex.: 504
   * repetido), não quando ela rodou certinho e só não achou
   * correspondência (série não é anime, por exemplo — isso é
   * `false`, comportamento normal). Antes, os dois casos eram
   * indistinguíveis (`[]` pros dois), e quem chama sempre caía pro
   * elenco do TMDB (foto de dublador) — inclusive quando a série ERA
   * um anime de verdade e só não deu pra confirmar por instabilidade
   * externa, o que mostrava informação errada com aparência de
   * certa. Agora quem chama pode decidir esconder a opção de
   * personagem inteira nesse caso, em vez de arriscar mostrar
   * dublador como se fosse personagem.
   */
  searchFailed: boolean;
}

/**
 * Ponto de entrada único: título (+ ano, se tiver) do TMDB entra,
 * lista de personagens sai, com uma bandeira dizendo se a busca
 * falhou de verdade ou só não achou nada (ver `AnimeCharactersResult`).
 *
 * TASK-168 (fonte adicional) — tenta o AniList primeiro (banco
 * próprio deles, sem scraping — mais estável que o Jikan, que já
 * mostrou instabilidade real, 504 repetido). Só recorre ao Jikan se
 * o AniList genuinamente falhar (`searchFailed`) — se o AniList
 * rodou certinho e não achou nada, não faz sentido tentar o Jikan
 * de novo pro mesmo título, o resultado tende a ser o mesmo.
 * `searchFailed` só fica `true` se as DUAS fontes falharem.
 */
export async function getAnimeCharacters(title: string, year: number | null): Promise<AnimeCharactersResult> {
  try {
    const aniList = await getAniListCharacters(title, year);
    if (!aniList.searchFailed) return aniList;

    console.error("[jikan] AniList falhou, tentando Jikan como reforço");
    const debug = await findMalIdWithDebug(title, year);
    if (debug.debugReason) return { characters: [], searchFailed: true };
    if (!debug.chosenMalId) return { characters: [], searchFailed: false };

    const { characters, failed } = await fetchCharactersByMalId(debug.chosenMalId);
    return { characters, searchFailed: failed };
  } catch (error) {
    console.error("[jikan] Falha ao buscar personagens do anime", error);
    return { characters: [], searchFailed: true };
  }
}
