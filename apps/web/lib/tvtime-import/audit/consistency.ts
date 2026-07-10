import { createClient } from "@/lib/supabase/client";

export interface ConsistencyResult {
  orphanedEpisodeSeries: number;
  fixedOrphans: number;
}

/**
 * TASK-027D, item 6 — "validar automaticamente... corrigir
 * automaticamente, nunca exigir intervenção do usuário".
 *
 * Duplicação de série/favorito/episódio é IMPOSSÍVEL de acontecer de
 * verdade no banco — as três tabelas (`series_status`,
 * `watched_episodes`, `favorites`) têm chave primária composta desde
 * que foram criadas, então o Postgres nunca permite duas linhas
 * iguais existirem. Por isso esta checagem não procura duplicata (não
 * tem onde ela existir) — procura o problema que É estruturalmente
 * possível: `watched_episodes` apontando pra uma série que não tem
 * `series_status` nenhum (órfã, ex.: de uma falha parcial numa
 * importação anterior). Corrige recriando o `series_status` que
 * faltava, nunca apagando progresso do usuário.
 */
export async function checkAndFixConsistency(userId: string): Promise<ConsistencyResult> {
  const supabase = createClient();

  const [episodesResult, statusResult] = await Promise.all([
    supabase.from("watched_episodes").select("series_id").eq("user_id", userId),
    supabase.from("series_status").select("series_id").eq("user_id", userId),
  ]);

  if (episodesResult.error) {
    console.error("[tvtime-import] Falha ao checar consistência (watched_episodes)", episodesResult.error);
    return { orphanedEpisodeSeries: 0, fixedOrphans: 0 };
  }
  if (statusResult.error) {
    console.error("[tvtime-import] Falha ao checar consistência (series_status)", statusResult.error);
    return { orphanedEpisodeSeries: 0, fixedOrphans: 0 };
  }

  const knownSeriesIds = new Set((statusResult.data ?? []).map((row) => row.series_id as number));
  const episodeSeriesIds = new Set((episodesResult.data ?? []).map((row) => row.series_id as number));
  const orphanIds = [...episodeSeriesIds].filter((id) => !knownSeriesIds.has(id));

  if (orphanIds.length === 0) {
    return { orphanedEpisodeSeries: 0, fixedOrphans: 0 };
  }

  console.warn(
    `[tvtime-import] ${orphanIds.length} série(s) com episódios assistidos mas sem series_status — recriando automaticamente`
  );

  const rows = orphanIds.map((seriesId) => ({
    user_id: userId,
    series_id: seriesId,
    status: "watching" as const,
    updated_at: new Date().toISOString(),
  }));

  const { error: fixError } = await supabase
    .from("series_status")
    .upsert(rows, { onConflict: "user_id,series_id", ignoreDuplicates: true });

  if (fixError) {
    console.error("[tvtime-import] Falha ao corrigir séries órfãs automaticamente", fixError);
    return { orphanedEpisodeSeries: orphanIds.length, fixedOrphans: 0 };
  }

  return { orphanedEpisodeSeries: orphanIds.length, fixedOrphans: orphanIds.length };
}
