import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { recalculateSeriesCategoryAfterEpisodeChange } from "./seriesCategoryRecalc";

const CONCURRENCY = 10;

/**
 * TASK-175 — ferramenta de reparo, a pedido (feedback de usuário:
 * série importada do Trakt presa em "Assistindo" pra sempre, status
 * só corrigia visitando uma por uma). Roda a MESMA função que já
 * existe pra recalcular categoria depois de marcar episódio — só que
 * pra TODAS as séries do usuário de uma vez, não uma só. Serve tanto
 * pra quem importou do Trakt antes da correção na importação em si
 * quanto pra qualquer outra situação onde a categoria ficou
 * desatualizada.
 */
export async function repairAllSeriesCategories(onProgress?: (done: number, total: number) => void): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) throw new Error("not authenticated");

  // TASK-175 (achado real, comprovado por SQL direto — Supabase
  // limita a 1000 linhas por consulta por padrão, sem paginação
  // explícita uma conta com muitos episódios batia nesse teto
  // silenciosamente) — mesmo padrão de `fetchAllWatchedEpisodeRows`
  // (lib/queries/library-state.ts).
  const PAGE_SIZE = 1000;
  const { count, error: countError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_special", false);
  if (countError) throw countError;

  const total = count ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id")
        .eq("user_id", user.id)
        .eq("is_special", false)
        .range(from, from + PAGE_SIZE - 1);
    })
  );

  const rows: { series_id: number }[] = [];
  for (const page of pages) {
    if (page.error) throw page.error;
    rows.push(...((page.data ?? []) as { series_id: number }[]));
  }

  const seriesIds = [...new Set(rows.map((r) => r.series_id))];
  onProgress?.(0, seriesIds.length);

  for (let start = 0; start < seriesIds.length; start += CONCURRENCY) {
    const batch = seriesIds.slice(start, start + CONCURRENCY);
    await Promise.all(
      batch.map((seriesId) =>
        recalculateSeriesCategoryAfterEpisodeChange(seriesId).catch((error) => {
          console.error(`[repair-series] Falha ao recalcular categoria da série ${seriesId}`, error);
        })
      )
    );
    onProgress?.(Math.min(start + CONCURRENCY, seriesIds.length), seriesIds.length);
  }

  return seriesIds.length;
}
