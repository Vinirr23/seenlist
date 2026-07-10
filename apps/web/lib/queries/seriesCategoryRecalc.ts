import { createClient } from "@/lib/supabase/client";
import { decideWatchingVsUpToDate } from "./airDateCategory";

/**
 * TASK-043 — achado real (Rancho Dutton, Demolidor, Dexter): marcar
 * episódio direto na tela nunca recalculava categoria nenhuma, só a
 * importação tinha essa regra. Chamado depois de qualquer mutation
 * que muda `watched_episodes` — só entra em ação quando o status
 * ATUAL já é "watching" ou "up_to_date" (nunca mexe em "paused"/
 * "want_to_watch" — isso continua sendo decisão explícita do
 * usuário, igual na importação).
 *
 * Limitação real, documentada: aqui não há como saber quais
 * (temporada, episódio) o TV Time chamaria de "especiais" fora do
 * momento da importação (essa informação não fica guardada em
 * lugar nenhum além do próprio `watched_episodes.is_special`, que só
 * cobre episódios JÁ assistidos, não os que faltam). Por isso a
 * exclusão de especiais aqui é só do lado assistido (via
 * `is_special = false` na contagem); do lado do TMDB, todo episódio
 * de temporada >= 1 conta como "principal" — pode gerar uma pequena
 * divergência em séries com muitos especiais internos (ex.: Lost),
 * mas é o melhor que dá pra fazer sem repetir a importação inteira.
 */
/**
 * TASK-046 (correção) — achado real: Dexter (2006), 96/96 episódios
 * marcados assistidos DIRETO NA TELA (não reimportação), TMDB
 * confirma `ended=true`, mas a série continuava em "Em dia" em vez
 * de "Assistidas". Causa: esta função nunca verificava a promoção
 * pra "completed" — só decidia entre "watching"/"up_to_date", e nem
 * buscava o `ended` do TMDB pra começo de conversa. Agora busca
 * `ended` também (mesma rota que o importador já usa) e checa a
 * MESMA regra de promoção da importação antes de cair pra
 * decideWatchingVsUpToDate.
 */
export async function recalculateSeriesCategoryAfterEpisodeChange(seriesId: number): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: statusRow, error: statusError } = await supabase
    .from("series_status")
    .select("status")
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (statusError || !statusRow) return;

  const currentStatus = statusRow.status as string;
  if (currentStatus !== "watching" && currentStatus !== "up_to_date") return;

  const { count: watchedCount } = await supabase
    .from("watched_episodes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("series_id", seriesId)
    .eq("is_special", false);

  let liveEpisodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] = [];
  let ended = false;
  try {
    const [episodesResponse, summaryResponse] = await Promise.all([
      fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: [seriesId] }),
      }),
      fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: [seriesId] }),
      }),
    ]);
    if (episodesResponse.ok) {
      const data = (await episodesResponse.json()) as {
        series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] }[];
      };
      liveEpisodes = data.series.find((s) => s.id === seriesId)?.episodes ?? [];
    }
    if (summaryResponse.ok) {
      const data = (await summaryResponse.json()) as { series: { id: number; ended: boolean }[] };
      ended = data.series.find((s) => s.id === seriesId)?.ended ?? false;
    }
  } catch (error) {
    console.error(
      "[series-category-recalc] Falha ao buscar dados do TMDB — categoria não recalculada desta vez.",
      error
    );
    return;
  }

  if (liveEpisodes.length === 0) return;

  const watched = watchedCount ?? 0;
  const allEpisodesWatched = watched >= liveEpisodes.length;
  const newCategory =
    ended && allEpisodesWatched ? "completed" : decideWatchingVsUpToDate(watched, liveEpisodes).category;

  if (newCategory === currentStatus) return;

  const { error: updateError } = await supabase
    .from("series_status")
    .update({ status: newCategory, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("series_id", seriesId);
  if (updateError) {
    console.error("[series-category-recalc] Falha ao atualizar categoria depois de marcar episódio.", updateError);
  }
}
