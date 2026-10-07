import { env } from "@/lib/env";
import type { AiProvider, SeasonRecapAiInput, SeasonRecapAiOutput } from "../types";
import { buildSeasonRecapPrompt } from "../seasonRecapPrompt";

/**
 * TASK (Resumo da Temporada) — implementação do contrato `AiProvider`
 * pra Google Gemini (free tier via Google AI Studio, escolha da V1).
 * Mecânica pura de chamada HTTP — a substância do que pedimos pro
 * modelo mora em `seasonRecapPrompt.ts`, compartilhada com qualquer
 * outro provedor que vier depois.
 *
 * Chamada via `fetch` direto (sem SDK `@google/generative-ai`) — é só
 * uma requisição REST, não há necessidade de uma dependência nova só
 * pra isso.
 *
 * BUG REAL CORRIGIDO (2026-10-07, teste real em produção — log do
 * servidor) — `gemini-2.5-flash` (nome original desta constante)
 * voltou 404 da API: "This model models/gemini-2.5-flash is no longer
 * available to new users. Please update your code to use
 * models/gemini-3.8-flash". Troquei pro nome que o PRÓPRIO Google
 * indicou na mensagem de erro, fonte primária de verdade (não um
 * blog/agregador). Se o catálogo mudar de novo no futuro, dá pra
 * sobrescrever sem mudar código nenhum via a variável de ambiente
 * `GEMINI_MODEL` — não precisa editar este arquivo de novo.
 */
const DEFAULT_MODEL = "gemini-3.8-flash";

function geminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * BUG REAL CORRIGIDO (2026-10-07, teste real em produção, logo depois
 * da correção do nome do modelo acima) — log do servidor mostrou um
 * 503 do Gemini ("This model is currently experiencing high demand...
 * Please try again later") derrubando a geração na hora, sem nenhuma
 * segunda tentativa. `tmdbGet` (`lib/tmdb/client.ts`) já tem exatamente
 * esse retry pra 429/5xx — eu não tinha replicado esse padrão aqui
 * quando escrevi este arquivo, e esse teste real mostrou que era
 * necessário. Mesma receita: só repete erro que faz sentido repetir
 * (429/5xx ou falha de rede), respeita `Retry-After` quando o Gemini
 * mandar, e desiste definitivo nos outros casos (ex.: 404 de modelo
 * errado, isso NUNCA se resolve tentando de novo).
 */
const GEMINI_MAX_RETRIES = 2;
const GEMINI_RETRY_BASE_DELAY_MS = 500;

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

      if (response.ok) {
        return (await response.json()) as GeminiGenerateContentResponse;
      }

      const errorBody = await response.text().catch(() => "");

      if (!isRetryableGeminiStatus(response.status) || attempt === GEMINI_MAX_RETRIES) {
        throw new Error(`[ai/gemini] Gemini respondeu ${response.status}: ${errorBody.slice(0, 300)}`);
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const delayMs = Number.isFinite(retryAfterMs) ? retryAfterMs : GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt;
      console.error(
        `[ai/gemini] Resposta ${response.status} — tentando de novo em ${delayMs}ms (tentativa ${attempt + 1}/${GEMINI_MAX_RETRIES}). Corpo: ${errorBody.slice(0, 200)}`
      );
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === GEMINI_MAX_RETRIES || (error instanceof Error && error.message.startsWith("[ai/gemini] Gemini respondeu"))) {
        throw error;
      }
      await sleep(GEMINI_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  // Inatingível na prática (o loop sempre retorna ou lança antes) — só pra satisfazer o typecheck.
  throw lastError instanceof Error ? lastError : new Error("[ai/gemini] Falha desconhecida.");
}

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

function extractResponseText(data: GeminiGenerateContentResponse): string {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("[ai/gemini] Resposta sem texto em candidates[0].content.parts[0].text.");
  }
  return text;
}

interface ParsedGeminiRecap {
  inThirtySeconds?: string;
  keyEvents?: unknown;
  whereItEnded?: string | null;
}

/**
 * POLIMENTO (2026-10-07) — `keyEvents` passou de string pra array de
 * strings (ver `SeasonRecapAiOutput`/`SEASON_RECAP_PROMPT_VERSION`).
 * O Gemini pode, mesmo instruído, devolver algo fora do formato (ex.:
 * uma string única, um array com item não-string, ou vazio) — melhor
 * rejeitar explicitamente aqui e deixar a rota tratar como falha de
 * geração (card fica oculto) do que gravar lixo no cache.
 */
function isValidKeyEventsArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

export function createGeminiProvider(): AiProvider {
  return {
    name: "gemini",
    async generateSeasonRecap(input: SeasonRecapAiInput): Promise<SeasonRecapAiOutput> {
      const prompt = buildSeasonRecapPrompt(input);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${env.geminiApiKey()}`;

      const data = await fetchGeminiGenerateContent(
        url,
        JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        })
      );
      const rawJson = extractResponseText(data);

      let parsed: ParsedGeminiRecap;
      try {
        parsed = JSON.parse(rawJson) as ParsedGeminiRecap;
      } catch {
        throw new Error(`[ai/gemini] Resposta não era JSON válido: ${rawJson.slice(0, 200)}`);
      }

      if (!parsed.inThirtySeconds || !isValidKeyEventsArray(parsed.keyEvents)) {
        throw new Error(
          `[ai/gemini] Resposta sem os campos obrigatórios ou keyEvents num formato inválido (esperado array de strings): ${JSON.stringify(parsed.keyEvents).slice(0, 200)}`
        );
      }

      return {
        inThirtySeconds: parsed.inThirtySeconds,
        keyEvents: parsed.keyEvents,
        // Defensivo: mesmo se o modelo "ignorar" a instrução de não
        // gerar esta seção, só confiamos no texto quando includeEnding
        // pediu por ela — nunca confiar cegamente na resposta do modelo
        // pra decidir isso.
        whereItEnded: input.includeEnding ? parsed.whereItEnded ?? null : null,
      };
    },
  };
}
