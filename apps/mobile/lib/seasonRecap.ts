const SITE_URL = "https://seenlist.app";

export interface SeasonRecapData {
  inThirtySeconds: string;
  keyEvents: string;
  whereItEnded: string | null;
}

interface SeasonRecapResponseBody {
  available: boolean;
  inThirtySeconds?: string;
  keyEvents?: string;
  whereItEnded?: string | null;
}

/**
 * TASK (Resumo da Temporada) — mesmo padrão de `episodeDetails.ts`
 * (rota já liberada no middleware pro app nativo). Devolve `null`
 * tanto em "sem dados suficientes" quanto em qualquer erro de
 * rede/servidor — o card some silenciosamente nos dois casos (seção 9
 * da auditoria), sem distinguir "indisponível" de "erro" pro usuário
 * comum.
 */
export async function fetchSeasonRecap(seriesId: number, seasonNumber: number, language = "pt-BR"): Promise<SeasonRecapData | null> {
  try {
    const response = await fetch(`${SITE_URL}/api/season-recap/${seriesId}/${seasonNumber}?language=${language}`);
    if (!response.ok) return null;
    const data = (await response.json()) as SeasonRecapResponseBody;
    if (!data.available || !data.inThirtySeconds || !data.keyEvents) return null;
    return { inThirtySeconds: data.inThirtySeconds, keyEvents: data.keyEvents, whereItEnded: data.whereItEnded ?? null };
  } catch (error) {
    console.error(`[seasonRecap] Falha ao buscar recap de ${seriesId}/${seasonNumber}.`, error);
    return null;
  }
}
