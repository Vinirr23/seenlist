import { supabase } from "@/lib/supabase";

export interface SeasonRecapData {
  inThirtySeconds: string;
  /**
   * POLIMENTO (2026-10-07, a pedido do usuário) — deixou de ser texto
   * corrido e virou array de acontecimentos discretos, pra render como
   * lista numerada na tela cheia (`[season].tsx`) em vez de dividir
   * texto arbitrariamente no cliente.
   */
  keyEvents: string[];
  whereItEnded: string | null;
}

interface SeasonRecapResponseBody {
  available: boolean;
  inThirtySeconds?: string;
  keyEvents?: unknown;
  whereItEnded?: string | null;
}

function isValidKeyEventsArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

/**
 * FASE 1 (migração mobile sem Vercel, 2026-10-20) — passou a chamar a
 * Supabase Edge Function `season-recap` em vez da rota Vercel
 * `/api/season-recap/[seriesId]/[season]`. MESMO contrato de
 * entrada/saída (ver `supabase/functions/season-recap/index.ts`) —
 * chave da Gemini e gravação em `season_recaps` continuam só no
 * servidor, nunca chegam ao app. Devolve `null` tanto em "sem dados
 * suficientes" quanto em qualquer erro de rede/servidor — o card some
 * silenciosamente nos dois casos (seção 9 da auditoria original),
 * sem distinguir "indisponível" de "erro" pro usuário comum.
 */
export async function fetchSeasonRecap(seriesId: number, seasonNumber: number, language = "pt-BR"): Promise<SeasonRecapData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("season-recap", {
      body: { seriesId, season: seasonNumber, language },
    });
    if (error) return null;
    const body = data as SeasonRecapResponseBody;
    if (!body.available || !body.inThirtySeconds || !isValidKeyEventsArray(body.keyEvents)) return null;
    return { inThirtySeconds: body.inThirtySeconds, keyEvents: body.keyEvents, whereItEnded: body.whereItEnded ?? null };
  } catch (error) {
    console.error(`[seasonRecap] Falha ao buscar recap de ${seriesId}/${seasonNumber}.`, error);
    return null;
  }
}
