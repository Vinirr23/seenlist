import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export type MappingConfidence = "auto" | "manual";

interface MappingRow {
  tvtime_id: string;
  tmdb_id: number;
}

/**
 * TASK-027.5 — "banco de equivalências permanente... aprender
 * continuamente". Uma consulta só (`in (...)`) busca TODOS os
 * mapeamentos já conhecidos pra essa importação de uma vez — nunca
 * uma consulta por série. Séries com mapeamento conhecido pulam
 * completamente a busca no TMDB (nem `cachedSeriesSearch` é
 * chamado).
 */
export async function fetchKnownMappings(tvtimeIds: string[]): Promise<Map<string, number>> {
  if (tvtimeIds.length === 0) return new Map();

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tvtime_tmdb_mappings")
      .select("tvtime_id, tmdb_id")
      .in("tvtime_id", tvtimeIds);

    if (error) {
      console.error(
        "[tvtime-import] Falha ao buscar mapeamentos conhecidos — seguindo sem cache permanente",
        describeSupabaseError(error)
      );
      return new Map();
    }

    return new Map((data as MappingRow[]).map((row) => [row.tvtime_id, row.tmdb_id]));
  } catch (thrown) {
    // Diferente de um `{ error }` devolvido normalmente, isso pega o
    // caso em que a chamada em si LANÇA (ex.: tabela não existe no
    // schema cache do PostgREST) — sem isso, essa falha propagava
    // como exceção não tratada.
    console.error(
      "[tvtime-import] Falha ao buscar mapeamentos conhecidos (exceção) — seguindo sem cache permanente",
      describeSupabaseError(thrown)
    );
    return new Map();
  }
}

/**
 * Chamado sempre que uma correspondência é confirmada (automática
 * por score alto, ou resolvida manualmente) — "sempre que uma
 * correspondência for confirmada, salvar permanentemente". Um
 * mapeamento já existente nunca é sobrescrito por um usuário comum
 * (sem policy de update pra isso, de propósito — ver a migration).
 *
 * É chamada como "fire-and-forget" (`void saveMapping(...)`, sem
 * `await`) pelo resto do importador, exatamente porque é
 * documentada como não-crítica. Isso só funciona de verdade se esta
 * função NUNCA deixar uma exceção escapar — por isso o try/catch
 * envolve a chamada inteira, não só o `{ error }` que o Supabase
 * devolve no caminho normal. Sem isso, uma falha aqui (ex.: tabela
 * ausente) vira uma promise rejeitada sem tratamento pra CADA série
 * confirmada na importação — foi exatamente isso que aconteceu
 * (247 erros não tratados, um por série).
 */
export async function saveMapping(
  tvtimeId: string,
  tmdbId: number,
  tvtimeName: string,
  confidence: MappingConfidence
): Promise<void> {
  try {
    const supabase = createClient();
    const { error, status, statusText } = await supabase
      .from("tvtime_tmdb_mappings")
      .upsert(
        { tvtime_id: tvtimeId, tmdb_id: tmdbId, tvtime_name: tvtimeName, confidence },
        { onConflict: "tvtime_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error(
        `[tvtime-import] Falha ao salvar mapeamento de "${tvtimeName}"`,
        describeSupabaseError(error, { status, statusText, tvtimeId, tmdbId, confidence })
      );
    }
  } catch (thrown) {
    console.error(
      `[tvtime-import] Falha ao salvar mapeamento de "${tvtimeName}" (exceção)`,
      describeSupabaseError(thrown, { tvtimeId, tmdbId, confidence })
    );
  }
}
