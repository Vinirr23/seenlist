// supabase/functions/season-recap/index.ts
//
// FASE 1 (migração mobile sem Vercel, item 2, 2026-10-20) — porta
// `apps/web/app/api/season-recap/[seriesId]/[season]/route.ts` (+
// `lib/ai/providers/gemini.ts` + `lib/ai/seasonRecapPrompt.ts`) pra
// uma Supabase Edge Function, SEM mudar nenhum comportamento: mesmo
// fluxo (cache primeiro → TMDB pt-BR → fallback en-US → cobertura 70%
// + checagem do finale → IA → grava cache → devolve), mesma tabela
// `season_recaps`, mesmo `SEASON_RECAP_PROMPT_VERSION` (2). Só o
// HOSPEDEIRO muda — a rota web em `apps/web` NÃO foi tocada. Mobile
// passa a chamar esta function em vez da rota Vercel (ver
// `apps/mobile/lib/seasonRecap.ts`).
//
// POR QUE PRECISA SER EDGE FUNCTION (não chamada direta à TMDB/Gemini
// do mobile) — duas razões, cada uma sozinha já bastaria:
//   1. A chave da Gemini (`GEMINI_API_KEY`) nunca pode chegar ao
//      cliente — é um segredo de verdade (cobra por uso), diferente
//      da TMDB_API_KEY (que o mobile já tem no próprio .env).
//   2. `season_recaps` (cache compartilhado do recap gerado) só é
//      gravável via chave de serviço, mesma razão de
//      `media_summaries_cache` em `library-summaries`.
//
// EFEITO COLATERAL PRESERVADO — `getSeasonEpisodesWithOverview`
// (importada de `_shared/tmdbSeries.ts`) grava em
// `series_season_episode_counts` (emblema "Temporada Concluída")
// exatamente como `apps/web/lib/tmdb/client.ts` faz, só que AGUARDADA
// (não fire-and-forget) — ver o comentário grande no topo de
// `_shared/tmdbSeries.ts` pro porquê dessa correção deliberada em
// relação ao código original da Vercel.
//
// AUTENTICAÇÃO — DIFERENTE das outras 3 functions desta fase (ver
// comentário grande mais abaixo, "CORREÇÃO 2026-10-20"): esta é a
// ÚNICA que chama uma API paga por uso (Gemini) a cada geração nova,
// por isso exige um USUÁRIO DE VERDADE autenticado, não só um JWT
// válido qualquer (a anon key sozinha, que é pública por design, não
// basta aqui — diferente de `library-summaries`/`series-data`/
// `tmdb-catalog`, que só leem/repassam dados públicos do TMDB e por
// isso aceitam a anon key normalmente).

// CORREÇÃO (2026-10-20, erro real de `deno check` reportado pelo
// usuário — ver `_shared/database.ts` pra causa raiz completa) —
// `createClient(...)` sem um `Database` genérico explícito faz
// `ReturnType<typeof createClient>` (usado na assinatura de
// `fetchEpisodesWithFallback` abaixo) resolver pra um tipo DIFERENTE
// do cliente real criado com argumentos. Corrigido com
// `createClient<Database>(...)` + `SupabaseClient<Database>`.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { tmdbGet, jsonResponse, CORS_HEADERS, sleep } from "../_shared/tmdb.ts";
import { getSeasonEpisodesWithOverview, type SeasonEpisodeOverview } from "../_shared/tmdbSeries.ts";
import type { Database } from "../_shared/database.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

// ---------------------------------------------------------------
// CORREÇÃO (2026-10-20, validação da Fase 1 — aprovada pelo usuário,
// 3 pontos pedidos: "exigir usuário autenticado de verdade", "proteção
// simples contra abuso de chamadas à Gemini", "evitar gerações
// duplicadas em chamadas simultâneas pra mesma temporada").
//
// 1) USUÁRIO DE VERDADE — `verify_jwt=true` (config.toml) só garante
//    um JWT válido, e a anon key (pública, embutida no bundle do app)
//    TAMBÉM é um JWT válido. Pra exigir uma SESSÃO DE USUÁRIO real,
//    criamos um segundo cliente Supabase usando a anon key + o
//    `Authorization` header que o chamador mandou, e chamamos
//    `auth.getUser()` nele — que só devolve um usuário quando o token
//    é de uma sessão de login de verdade, não a anon key sozinha.
//    Mecanismo OFICIAL do supabase-js para isso (não é um parser de
//    JWT caseiro) — reaproveita exatamente a mesma validação que o
//    próprio Supabase já faz, só que também pedindo o usuário.
//
// 2) PROTEÇÃO CONTRA ABUSO (simples, por usuário) — um limite de
//    janela deslizante EM MEMÓRIA (Map, sem tabela nova, sem migration
//    — por pedido explícito do usuário de não montar agora um sistema
//    geral de rate limiting): no máximo `GEMINI_CALLS_PER_USER_MAX`
//    gerações NOVAS (cache hit não conta) por usuário em
//    `GEMINI_CALLS_PER_USER_WINDOW_MS`. **Limitação honesta, não
//    assumida como garantia forte**: isto é por isolado Deno — um
//    isolado "quente" mantém o Map entre chamadas (cobre o caso comum
//    de abuso, um mesmo cliente batendo repetido), mas reinicia num
//    cold start e não é compartilhado entre isolados paralelos sob
//    carga alta. Se no futuro isso precisar ser à prova de múltiplos
//    isolados/distribuído, a solução correta é uma tabela no Postgres
//    (contagem por usuário com janela) — decisão maior, deixada pra
//    você avaliar com métricas reais de uso, como você pediu.
//
// 3) DEDUPE DE CHAMADAS SIMULTÂNEAS (mesma temporada) — outro Map em
//    memória (`inFlightGenerations`), chave `tmdbId:season:language`:
//    se já existe uma geração em andamento pra essa chave, a chamada
//    nova AGUARDA a mesma Promise em vez de disparar uma segunda
//    chamada à Gemini pro mesmo conteúdo. Mesma limitação honesta do
//    item 2 — cobre concorrência dentro do MESMO isolado (o caso real
//    mais provável: dois usuários abrindo a mesma temporada quase ao
//    mesmo tempo, atendidos pelo mesmo isolado quente), não garante
//    exclusão entre isolados diferentes rodando em paralelo. Reduz a
//    janela de corrida drasticamente sem precisar de lock no Postgres
//    (que exigiria uma function/migration nova).
// ---------------------------------------------------------------
async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

const GEMINI_CALLS_PER_USER_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const GEMINI_CALLS_PER_USER_MAX = 20; // gerações NOVAS (cache hit não conta)
const recentGenerationsByUser = new Map<string, number[]>();

function isUserOverGeminiLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (recentGenerationsByUser.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < GEMINI_CALLS_PER_USER_WINDOW_MS
  );
  recentGenerationsByUser.set(userId, recent);
  return recent.length >= GEMINI_CALLS_PER_USER_MAX;
}

function recordGeminiGeneration(userId: string): void {
  const recent = recentGenerationsByUser.get(userId) ?? [];
  recent.push(Date.now());
  recentGenerationsByUser.set(userId, recent);
}

const inFlightGenerations = new Map<string, Promise<SeasonRecapAiOutput>>();

interface TmdbSeriesSummaryResponse {
  id: number;
  name: string;
  original_name: string;
}

/** Só o campo `title` é usado pelo prompt — versão mínima de `getSeriesSummary`, de propósito (não precisa do resto pra esta function). */
async function getSeriesTitle(seriesId: number, language: string): Promise<string> {
  const data = await tmdbGet<TmdbSeriesSummaryResponse>(`/tv/${seriesId}`, { language });
  return data.name;
}

// ---------------------------------------------------------------
// Gemini — mesma mecânica de `apps/web/lib/ai/providers/gemini.ts`
// (mesmo retry, mesmo modelo default, mesma validação de resposta).
// ---------------------------------------------------------------
const DEFAULT_MODEL = "gemini-3.8-flash";

function geminiModel(): string {
  return Deno.env.get("GEMINI_MODEL") || DEFAULT_MODEL;
}

const GEMINI_MAX_RETRIES = 2;
const GEMINI_RETRY_BASE_DELAY_MS = 500;

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

interface GeminiGenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function fetchGeminiGenerateContent(url: string, body: string): Promise<GeminiGenerateContentResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (response.ok) return (await response.json()) as GeminiGenerateContentResponse;

      const errorBody = await response.text().catch(() => "");
      if (!isRetryableGeminiStatus(response.status) || attempt === GEMINI_MAX_RETRIES) {
        throw new Error(`[season-recap/gemini] Gemini respondeu ${response.status}: ${errorBody.slice(0, 300)}`);
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const delayMs = Number.isFinite(retryAfterMs) ? retryAfterMs : GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.error(`[season-recap/gemini] Resposta ${response.status} — tentando de novo em ${delayMs}ms (tentativa ${attempt + 1}/${GEMINI_MAX_RETRIES}). Corpo: ${errorBody.slice(0, 200)}`);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === GEMINI_MAX_RETRIES || (error instanceof Error && error.message.startsWith("[season-recap/gemini] Gemini respondeu"))) {
        throw error;
      }
      await sleep(GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("[season-recap/gemini] Falha desconhecida.");
}

function extractResponseText(data: GeminiGenerateContentResponse): string {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("[season-recap/gemini] Resposta sem texto em candidates[0].content.parts[0].text.");
  return text;
}

function isValidKeyEventsArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

interface SeasonRecapAiInput {
  seriesName: string;
  seasonNumber: number;
  episodes: { episodeNumber: number; name: string; overview: string }[];
  includeEnding: boolean;
}

interface SeasonRecapAiOutput {
  inThirtySeconds: string;
  keyEvents: string[];
  whereItEnded: string | null;
}

interface ParsedGeminiRecap {
  inThirtySeconds?: string;
  keyEvents?: unknown;
  whereItEnded?: string | null;
}

/** Mesmo prompt de `apps/web/lib/ai/seasonRecapPrompt.ts` — texto IDÊNTICO, só copiado (não é compartilhável entre runtimes Node/Deno sem um pacote publicado). Bump `SEASON_RECAP_PROMPT_VERSION` nos dois lados se o texto mudar. */
const SEASON_RECAP_PROMPT_VERSION = 2;

function buildSeasonRecapPrompt(input: SeasonRecapAiInput): string {
  const episodesText = input.episodes.map((ep) => `Episódio ${ep.episodeNumber}: ${ep.name}\n${ep.overview}`).join("\n\n");

  const endingField = input.includeEnding
    ? `"whereItEnded": string — como a temporada termina, baseado SOMENTE na sinopse do último episódio acima, em texto corrido (1-2 frases)`
    : `"whereItEnded": null — não gere esta seção; a sinopse do episódio final não está disponível nos dados fornecidos`;

  const KEY_EVENTS_EXAMPLE = [
    "Ana descobre que o namorado está escondendo uma dívida antiga.",
    "Joel se muda para o apartamento de cima e os dois começam a se evitar.",
    "A empresa da família enfrenta uma auditoria inesperada.",
    "Ana e Joel são forçados a trabalhar juntos num projeto.",
    "A temporada termina com os dois finalmente se acertando.",
  ];

  return `Você é um redator que resume temporadas de séries de TV para um app de acompanhamento de séries, usando SOMENTE as sinopses de episódio fornecidas abaixo.

REGRA MAIS IMPORTANTE: nunca invente, deduza ou complete acontecimentos que não estejam EXPLICITAMENTE escritos nessas sinopses. Se uma informação não estiver nos dados fornecidos, deixe de fora — não tente adivinhar o que "provavelmente" aconteceu, mesmo que você reconheça a obra e saiba como a história continua. Use exclusivamente o material abaixo.

Série: ${input.seriesName}
Temporada: ${input.seasonNumber}

Sinopses dos episódios, em ordem cronológica:

${episodesText}

Gere um JSON com exatamente estes campos, sempre em português do Brasil:
{
  "inThirtySeconds": string — um resumo BEM direto de NO MÁXIMO 2-3 frases curtas, que dá pra ler de verdade em uns 30 segundos — não é um resumo completo, é só o essencial pra quem não vai ler o resto,
  "keyEvents": array de strings — os principais acontecimentos da temporada, cada item uma frase curta e autocontida descrevendo UM acontecimento discreto (nunca um parágrafo só, nunca juntar vários acontecimentos numa frase com "e"), em ordem cronológica, tipicamente entre 4 e 7 itens. Exemplo do formato esperado (conteúdo de outra série, só pra ilustrar o formato): ${JSON.stringify(KEY_EVENTS_EXAMPLE)},
  ${endingField}
}

Responda só com o JSON, sem nenhum texto antes ou depois, sem markdown.`;
}

async function generateSeasonRecap(input: SeasonRecapAiInput): Promise<SeasonRecapAiOutput> {
  const prompt = buildSeasonRecapPrompt(input);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${GEMINI_API_KEY}`;

  const data = await fetchGeminiGenerateContent(
    url,
    JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    })
  );
  const rawJson = extractResponseText(data);

  let parsed: ParsedGeminiRecap;
  try {
    parsed = JSON.parse(rawJson) as ParsedGeminiRecap;
  } catch {
    throw new Error(`[season-recap/gemini] Resposta não era JSON válido: ${rawJson.slice(0, 200)}`);
  }

  if (!parsed.inThirtySeconds || !isValidKeyEventsArray(parsed.keyEvents)) {
    throw new Error(`[season-recap/gemini] Resposta sem os campos obrigatórios ou keyEvents num formato inválido: ${JSON.stringify(parsed.keyEvents).slice(0, 200)}`);
  }

  return {
    inThirtySeconds: parsed.inThirtySeconds,
    keyEvents: parsed.keyEvents,
    whereItEnded: input.includeEnding ? parsed.whereItEnded ?? null : null,
  };
}

// ---------------------------------------------------------------
// Fluxo da rota — EXATAMENTE igual a
// `apps/web/app/api/season-recap/[seriesId]/[season]/route.ts`.
// ---------------------------------------------------------------
const MIN_COVERAGE = 0.7;
const MIN_OVERVIEW_LENGTH = 40;

function isUsableOverview(overview: string): boolean {
  return overview.trim().length >= MIN_OVERVIEW_LENGTH;
}

async function fetchEpisodesWithFallback(
  supabase: SupabaseClient<Database>,
  seriesId: number,
  seasonNumber: number
): Promise<SeasonEpisodeOverview[]> {
  const ptEpisodes = await getSeasonEpisodesWithOverview(supabase, String(seriesId), seasonNumber, "pt-BR");
  const needsFallback = ptEpisodes.some((ep) => !isUsableOverview(ep.overview));
  if (!needsFallback) return ptEpisodes;

  const enEpisodes = await getSeasonEpisodesWithOverview(supabase, String(seriesId), seasonNumber, "en-US");
  const enByNumber = new Map(enEpisodes.map((ep) => [ep.episodeNumber, ep]));

  return ptEpisodes.map((ep) => {
    if (isUsableOverview(ep.overview)) return ep;
    const fallback = enByNumber.get(ep.episodeNumber);
    return fallback && isUsableOverview(fallback.overview) ? fallback : ep;
  });
}

async function computeSourceHash(episodes: SeasonEpisodeOverview[]): Promise<string> {
  const concatenated = episodes
    .slice()
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
    .map((ep) => `${ep.episodeNumber}:${ep.overview}`)
    .join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(concatenated));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface SeasonRecapRow {
  in_thirty_seconds: string;
  key_events: unknown;
  where_it_ended: string | null;
  prompt_version: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  // CORREÇÃO (2026-10-20) — exige usuário autenticado de verdade antes
  // de qualquer trabalho (inclusive leitura de cache), não só um JWT
  // válido qualquer. Ver comentário grande no topo do arquivo.
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return jsonResponse({ error: "Autenticação necessária — faça login para gerar o resumo da temporada." }, 401);
  }

  let body: Partial<{ seriesId: number; season: number; language: string }>;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[season-recap] Corpo da requisição inválido.", error);
    return jsonResponse({ error: "Requisição inválida." }, 400);
  }

  const tmdbId = Number(body.seriesId);
  const seasonNumber = Number(body.season);
  const language = body.language || "pt-BR";
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !Number.isInteger(seasonNumber) || seasonNumber <= 0) {
    return jsonResponse({ error: "Parâmetros inválidos." }, 400);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: cached, error: cacheReadError } = await supabase
    .from("season_recaps")
    .select("in_thirty_seconds, key_events, where_it_ended, prompt_version")
    .eq("tmdb_id", tmdbId)
    .eq("season_number", seasonNumber)
    .eq("language", language)
    .maybeSingle();

  if (cacheReadError) {
    console.error(`[season-recap] Falha ao ler cache de ${tmdbId}/${seasonNumber}/${language}.`, cacheReadError.message);
  }

  if (cached) {
    const row = cached as SeasonRecapRow;
    const isCurrentVersion = row.prompt_version === SEASON_RECAP_PROMPT_VERSION;
    const hasValidKeyEvents = isValidKeyEventsArray(row.key_events);

    if (isCurrentVersion && hasValidKeyEvents) {
      return jsonResponse({
        available: true,
        inThirtySeconds: row.in_thirty_seconds,
        keyEvents: row.key_events,
        whereItEnded: row.where_it_ended,
      });
    }
    if (isCurrentVersion && !hasValidKeyEvents) {
      console.warn(`[season-recap] Cache de ${tmdbId}/${seasonNumber}/${language} tinha prompt_version atual mas key_events num formato inválido — tratando como cache inválido e regenerando.`);
    }
  }

  try {
    const [episodes, seriesName] = await Promise.all([
      fetchEpisodesWithFallback(supabase, tmdbId, seasonNumber),
      getSeriesTitle(tmdbId, language),
    ]);

    if (episodes.length === 0) return jsonResponse({ available: false });

    const usableCount = episodes.filter((ep) => isUsableOverview(ep.overview)).length;
    const coverage = usableCount / episodes.length;
    const finale = episodes.reduce((latest, ep) => (ep.episodeNumber > latest.episodeNumber ? ep : latest));
    const finaleUsable = isUsableOverview(finale.overview);

    if (coverage < MIN_COVERAGE) return jsonResponse({ available: false });

    // CORREÇÃO (2026-10-20) — dedupe de chamadas simultâneas pra MESMA
    // temporada: se já existe uma geração em andamento (mesmo isolado)
    // pra esta chave exata, entra na fila da MESMA promise em vez de
    // disparar uma 2ª chamada à Gemini pro mesmo conteúdo.
    const generationKey = `${tmdbId}:${seasonNumber}:${language}`;
    let generationPromise = inFlightGenerations.get(generationKey);

    if (!generationPromise) {
      // Só verifica/conta o limite de abuso quando VAI de fato disparar
      // uma chamada nova — quem só entra na fila de uma já em andamento
      // não consome cota (não gera custo adicional de Gemini).
      if (isUserOverGeminiLimit(userId)) {
        return jsonResponse(
          { error: "Muitas gerações de resumo em um curto período. Tente novamente em alguns minutos." },
          429
        );
      }
      recordGeminiGeneration(userId);

      generationPromise = generateSeasonRecap({
        seriesName,
        seasonNumber,
        episodes: episodes.map((ep) => ({ episodeNumber: ep.episodeNumber, name: ep.name, overview: ep.overview })),
        includeEnding: finaleUsable,
      });
      inFlightGenerations.set(generationKey, generationPromise);
      generationPromise.finally(() => {
        // Só remove a ENTRADA ATUAL (nunca uma mais nova que possa ter
        // substituído esta no Map entretanto) — evita apagar por engano
        // a promise de uma geração seguinte pra mesma chave.
        if (inFlightGenerations.get(generationKey) === generationPromise) {
          inFlightGenerations.delete(generationKey);
        }
      });
    }

    const result = await generationPromise;

    const { error: writeError } = await supabase.from("season_recaps").upsert(
      {
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        language,
        in_thirty_seconds: result.inThirtySeconds,
        key_events: result.keyEvents,
        where_it_ended: result.whereItEnded,
        source_hash: await computeSourceHash(episodes),
        episode_coverage: coverage,
        ai_provider: "gemini",
        prompt_version: SEASON_RECAP_PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "tmdb_id,season_number,language" }
    );
    if (writeError) {
      console.error(`[season-recap] FALHA AO GRAVAR season_recaps (${tmdbId}/${seasonNumber}/${language}) — recap gerado com sucesso mas vai ser regenerado (custo de IA de novo) na próxima chamada.`, writeError.message);
    }

    return jsonResponse({
      available: true,
      inThirtySeconds: result.inThirtySeconds,
      keyEvents: result.keyEvents,
      whereItEnded: result.whereItEnded,
    });
  } catch (error) {
    console.error(`[season-recap] Falha ao gerar recap de ${tmdbId}/${seasonNumber}/${language}.`, error);
    return jsonResponse({ available: false });
  }
});
