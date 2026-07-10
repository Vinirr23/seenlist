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
/**
 * TASK-061 (correção real, comprovada) — achado: séries adicionadas
 * pelo botão "+" (Explorar, ou qualquer outro "adicionar à
 * biblioteca") entram com status "want_to_watch". Esta função só
 * verificava `currentStatus === "watching" || "up_to_date"` — uma
 * série em "want_to_watch" que passava a ter episódios marcados
 * NUNCA era promovida pra "watching", ficando presa em
 * "want_to_watch" pra sempre, mesmo com 100% dos episódios
 * assistidos (porque a checagem de "completed" só rodava DEPOIS de
 * passar por esse guard). Isso reproduzia exatamente os dois bugs
 * relatados: contagem de "assistindo"/stats zerada mesmo com
 * episódios registrados, e série nunca migrando pra "Assistidas".
 *
 * "paused" continua de fora de propósito — é decisão explícita do
 * usuário (pausou a série), diferente de "want_to_watch" (nunca
 * decidiu ativamente começar). Marcar um episódio antigo numa série
 * pausada não deveria tirá-la da pausa sozinha.
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
  if (statusError) return;

  /**
   * TASK-062 (correção real, comprovada) — achado: série adicionada
   * só marcando episódios (nunca passou por `useMoveLibraryItem`)
   * nunca ganha linha em `series_status` — o "Assistindo" que
   * aparece na tela é só o fallback derivado de
   * `buildLibraryItemsFromRows` (`isDerived: !explicit` → status
   * "watching"), nunca gravado. Antes, `!statusRow` cortava a função
   * aqui mesmo — ou seja, uma série "derivada" NUNCA podia ser
   * promovida pra "Em dia"/"Concluído", não importa quantos
   * episódios fossem marcados (reproduzido com Frieren e a Jornada
   * para o Além, 38/38 episódios, presa em "Assistindo"). Sem linha
   * = trata como "watching" (o mesmo fallback que a tela já assume)
   * e segue o fluxo normal — se a categoria mudar, o UPDATE abaixo
   * vira um UPSERT (cria a linha que nunca existiu, com a categoria
   * já correta).
   */
  const currentStatus = statusRow?.status ?? "watching";
  const eligibleForRecalc = currentStatus === "watching" || currentStatus === "up_to_date" || currentStatus === "want_to_watch";
  if (!eligibleForRecalc) return;

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

  /**
   * TASK-062 — `upsert` em vez de `update`: séries sem linha prévia
   * (o caso "derivado" corrigido acima) precisam que a linha seja
   * CRIADA agora, com a categoria já correta — um `update` sozinho
   * não faz nada quando a linha não existe (0 rows affected, sem
   * erro nenhum), o que reproduziria o mesmo bug de um jeito
   * diferente (a função "decide" a categoria certa mas nunca grava).
   */
  const { error: updateError } = await supabase
    .from("series_status")
    .upsert(
      { user_id: user.id, series_id: seriesId, status: newCategory, updated_at: new Date().toISOString() },
      { onConflict: "user_id,series_id" }
    );
  if (updateError) {
    console.error("[series-category-recalc] Falha ao atualizar categoria depois de marcar episódio.", updateError);
  }
}