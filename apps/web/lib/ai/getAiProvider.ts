import { env } from "@/lib/env";
import type { AiProvider } from "./types";
import { createGeminiProvider } from "./providers/gemini";

/**
 * Fábrica única — a rota /api/season-recap chama só `getAiProvider()`,
 * nunca importa a implementação de um provedor específico direto.
 * Trocar o provedor em produção é: escrever `providers/<novo>.ts`
 * implementando `AiProvider`, adicionar um `case` aqui, e mudar a env
 * var `AI_PROVIDER` — zero mudança na rota, na regra de cobertura ou
 * no cache.
 */
export function getAiProvider(): AiProvider {
  const provider = env.aiProvider();
  switch (provider) {
    case "gemini":
      return createGeminiProvider();
    default:
      throw new Error(`[ai] Provedor de IA desconhecido: "${provider}" (variável de ambiente AI_PROVIDER).`);
  }
}
