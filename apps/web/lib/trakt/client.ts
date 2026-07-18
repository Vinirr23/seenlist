import { env } from "@/lib/env";

const TRAKT_API_BASE = "https://api.trakt.tv";
export const TRAKT_REDIRECT_URI = "https://seenlist.app/import/trakt/callback";

/**
 * TASK-171 — cliente do Trakt, só roda no servidor (rota de API/
 * Route Handler) — `TRAKT_CLIENT_SECRET` nunca pode chegar ao
 * navegador. Diferente do TMDB (chave só de leitura, sem OAuth),
 * aqui existe um token de usuário de verdade — por isso o cuidado
 * extra de nunca devolver o token pro cliente (fica só num cookie
 * httpOnly, ver `callback/route.ts`).
 */

interface TraktTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeTraktCode(code: string): Promise<string> {
  const response = await fetch(`${TRAKT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: env.traktClientId(),
      client_secret: env.traktClientSecret(),
      redirect_uri: TRAKT_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Trakt token exchange falhou: HTTP ${response.status}`);
  }
  const data = (await response.json()) as TraktTokenResponse;
  return data.access_token;
}

function traktHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": env.traktClientId(),
    Authorization: `Bearer ${accessToken}`,
  };
}

export interface TraktIds {
  trakt: number;
  slug: string | null;
  imdb: string | null;
  tmdb: number | null;
  tvdb?: number | null;
}

export interface TraktHistoryItem {
  id: number;
  watched_at: string;
  type: "movie" | "episode";
  movie?: { title: string; year: number | null; ids: TraktIds };
  show?: { title: string; year: number | null; ids: TraktIds };
  episode?: { season: number; number: number; title: string | null };
}

export interface TraktRatingItem {
  rated_at: string;
  rating: number;
  type: "movie" | "show";
  movie?: { title: string; ids: TraktIds };
  show?: { title: string; ids: TraktIds };
}

export interface TraktWatchlistItem {
  type: "movie" | "show";
  movie?: { title: string; ids: TraktIds };
  show?: { title: string; ids: TraktIds };
}

/**
 * Busca todas as páginas de um endpoint do Trakt (limite alto por
 * página — 1000 — pra minimizar quantidade de requisições; a
 * maioria das contas cabe numa página só mesmo assim). Teto de
 * segurança em 50 páginas (50 mil itens) — nunca deveria bater nisso
 * de verdade, só evita um loop infinito em caso de resposta
 * inesperada do Trakt.
 */
async function fetchTraktPaginated<T>(path: string, accessToken: string): Promise<T[]> {
  const results: T[] = [];
  const SAFETY_MAX_PAGES = 50;

  for (let page = 1; page <= SAFETY_MAX_PAGES; page++) {
    const response = await fetch(`${TRAKT_API_BASE}${path}${path.includes("?") ? "&" : "?"}limit=1000&page=${page}`, {
      headers: traktHeaders(accessToken),
    });
    if (!response.ok) {
      throw new Error(`Trakt ${path} falhou: HTTP ${response.status}`);
    }
    const data = (await response.json()) as T[];
    results.push(...data);

    const totalPages = Number(response.headers.get("X-Pagination-Page-Count") ?? "1");
    if (page >= totalPages) break;
  }

  return results;
}

export function fetchTraktMovieHistory(accessToken: string) {
  return fetchTraktPaginated<TraktHistoryItem>("/sync/history/movies", accessToken);
}

export function fetchTraktEpisodeHistory(accessToken: string) {
  return fetchTraktPaginated<TraktHistoryItem>("/sync/history/episodes", accessToken);
}

export function fetchTraktMovieRatings(accessToken: string) {
  return fetchTraktPaginated<TraktRatingItem>("/sync/ratings/movies", accessToken);
}

export function fetchTraktShowRatings(accessToken: string) {
  return fetchTraktPaginated<TraktRatingItem>("/sync/ratings/shows", accessToken);
}

export function fetchTraktMovieWatchlist(accessToken: string) {
  return fetchTraktPaginated<TraktWatchlistItem>("/sync/watchlist/movies", accessToken);
}

export function fetchTraktShowWatchlist(accessToken: string) {
  return fetchTraktPaginated<TraktWatchlistItem>("/sync/watchlist/shows", accessToken);
}
