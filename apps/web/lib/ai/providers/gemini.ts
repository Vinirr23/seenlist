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
 * ATENÇÃO: o nome do modelo abaixo (`DEFAULT_MODEL`) precisa ser
 * confirmado no Google AI Studio antes de ir pra produção — o catálogo
 * de modelos do Gemini muda com frequência, e eu não tenho como saber
 * com certeza, nesta auditoria, qual nome exato está disponível no
 * free tier no momento em que isto for de fato publicado. Pode ser
 * sobrescrito sem mudar código nenhum via a variável de ambiente
 * `GEMINI_MODEL`.
 */
const DEFAULT_MODEL = "gemini-2.5-flash";

function geminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
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
  keyEvents?: string;
  whereItEnded?: string | null;
}

export function createGeminiProvider(): AiProvider {
  return {
    name: "gemini",
    async generateSeasonRecap(input: SeasonRecapAiInput): Promise<SeasonRecapAiOutput> {
      const prompt = buildSeasonRecapPrompt(input);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${env.geminiApiKey()}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`[ai/gemini] Gemini respondeu ${response.status}: ${errorBody.slice(0, 300)}`);
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const rawJson = extractResponseText(data);

      let parsed: ParsedGeminiRecap;
      try {
        parsed = JSON.parse(rawJson) as ParsedGeminiRecap;
      } catch {
        throw new Error(`[ai/gemini] Resposta não era JSON válido: ${rawJson.slice(0, 200)}`);
      }

      if (!parsed.inThirtySeconds || !parsed.keyEvents) {
        throw new Error("[ai/gemini] Resposta sem os campos obrigatórios (inThirtySeconds/keyEvents).");
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
