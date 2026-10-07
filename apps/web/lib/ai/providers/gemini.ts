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
