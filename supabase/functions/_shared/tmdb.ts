// supabase/functions/_shared/tmdb.ts
//
// FASE 1 (migração mobile sem Vercel, 2026-10-20) — client TMDB de
// baixo nível, compartilhado por TODAS as Edge Functions desta fase
// (`library-summaries`, `season-recap`, `series-data`). Antes havia
// uma cópia quase idêntica deste helper em cada function — movido pra
// `_shared/` a pedido explícito do usuário ("sem duplicar código
// desnecessariamente"), mesmo padrão já usado por `weekBounds.ts`.
//
// Mesmo retry/backoff de `apps/web/lib/tmdb/client.ts` (`tmdbGet`): só
// repete erro que faz sentido repetir (429/5xx), respeita
// `Retry-After` quando o TMDB manda, 300ms de base com crescimento
// exponencial. A rota web NÃO foi tocada — isto é uma cópia fiel.

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY")!;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const TMDB_MAX_RETRIES = 2;
const TMDB_RETRY_BASE_DELAY_MS = 300;

function isRetryableTmdbStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "pt-BR");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  let lastError: unknown;
  for (let attempt = 0; attempt <= TMDB_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return (await response.json()) as T;

      if (!isRetryableTmdbStatus(response.status) || attempt === TMDB_MAX_RETRIES) {
        throw new Error(`TMDB respondeu ${response.status} em ${path}`);
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const delayMs = Number.isFinite(retryAfterMs) ? retryAfterMs : TMDB_RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.error(`[tmdb] Resposta ${response.status} em ${path} — tentando de novo em ${delayMs}ms (tentativa ${attempt + 1}/${TMDB_MAX_RETRIES}).`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === TMDB_MAX_RETRIES) throw error;
      await sleep(TMDB_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`TMDB falhou em ${path}`);
}

export { sleep };

/**
 * CORS — todas as functions desta fase são chamadas DIRETO pelo app
 * mobile (`supabase.functions.invoke`), não só por `pg_cron`/`pg_net`
 * como as 6 functions já existentes do projeto. Cabeçalhos iguais em
 * todas, centralizados aqui por consistência.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/**
 * Gênero de SÉRIE em inglês que o TMDB nunca traduziu pro português —
 * mesma lista/correção de `apps/web/lib/tmdb/client.ts`
 * (`translateTvGenreName`/`TV_GENRE_NAME_OVERRIDES_PT_BR`). Usada por
 * mais de uma Edge Function (`library-summaries`, `_shared/tmdbSeries.ts`)
 * — centralizada aqui, a pedido explícito do usuário, pra não
 * duplicar a mesma lista em cada uma.
 */
const TV_GENRE_NAME_OVERRIDES_PT_BR: Record<string, string> = {
  "Action & Adventure": "Ação e aventura",
  Kids: "Infantil",
  News: "Notícias",
  Reality: "Reality show",
  "Sci-Fi & Fantasy": "Ficção científica e fantasia",
  Soap: "Novela",
  Talk: "Talk show",
  "War & Politics": "Guerra e política",
};

export function translateTvGenreName(name: string, language: string): string {
  if (language !== "pt-BR") return name;
  return TV_GENRE_NAME_OVERRIDES_PT_BR[name] ?? name;
}

/**
 * CONTINUAÇÃO DA FASE 1 (2026-10-20, varredura das rotas pendentes) —
 * dedupe de provedor de streaming ("Netflix"/"Netflix Standard with
 * Ads", "Paramount Plus"/"Paramount+ Amazon Channel"). Cópia fiel de
 * `apps/web/lib/tmdb/client.ts` (`normalizeProviderName`/
 * `dedupeWatchProviders`). Movido pra `_shared/tmdb.ts` (em vez de
 * duplicar em `_shared/tmdbSeries.ts` E `_shared/tmdbCatalog.ts`, que
 * precisam dos DOIS — providers de série e de filme usam exatamente a
 * mesma lógica) — a pedido de sempre do usuário, "sem duplicar código
 * desnecessariamente". `_shared/tmdbSeries.ts` foi atualizado pra
 * importar de aqui em vez de manter sua própria cópia.
 */
export function normalizeProviderName(name: string): string {
  return name.toLowerCase().replace(/\+/g, " plus").replace(/\s+/g, " ").trim();
}

export function dedupeWatchProviders<T extends { name: string }>(providers: T[]): T[] {
  const sorted = [...providers].sort((a, b) => a.name.length - b.name.length);
  const kept: T[] = [];
  for (const provider of sorted) {
    const normalized = normalizeProviderName(provider.name);
    const isVariantOfKept = kept.some((existing) => normalized.startsWith(`${normalizeProviderName(existing.name)} `));
    if (!isVariantOfKept) kept.push(provider);
  }
  const keptIds = new Set(kept.map((p) => p.name));
  return providers.filter((p) => keptIds.has(p.name));
}
