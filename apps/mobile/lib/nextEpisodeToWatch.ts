import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchLiveEpisodesBySeriesId } from "@/lib/seriesDetails";
import { computeBadge, type UpcomingBadge } from "@/lib/upcomingEpisodes";
import { todayLocalKey } from "@/lib/localDate";

const WATCHED_KEYS_PAGE_SIZE = 1000;

export interface NextEpisodeToWatch {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  /** Quantos episódios A MAIS (além deste) já foram ao ar e também estão pendentes — o "+N" do card. */
  additionalPendingCount: number;
  badge: UpcomingBadge;
}

/** Mesma paginação já usada em fetchLibraryItems/recalculateUpToDateSeriesCategories — evita o limite padrão de 1000 linhas cortar o resultado. */
/** Mesma paginação paralela já usada em fetchLibraryItems/recalculateUpToDateSeriesCategories (TASK-149 — busca a contagem primeiro, depois todas as páginas ao mesmo tempo, em vez de uma de cada vez). */
async function fetchWatchedEpisodeKeysBySeriesId(userId: string, seriesIds: number[]): Promise<Map<number, Set<string>>> {
  const bySeriesId = new Map<number, Set<string>>();

  const { count, error: countError } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_special", false)
    .in("series_id", seriesIds);
  if (countError) throw countError;

  const total = count ?? 0;
  if (total === 0) return bySeriesId;

  const pageCount = Math.ceil(total / WATCHED_KEYS_PAGE_SIZE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) => {
      const from = index * WATCHED_KEYS_PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id, season_number, episode_number")
        .eq("user_id", userId)
        .eq("is_special", false)
        .in("series_id", seriesIds)
        .range(from, from + WATCHED_KEYS_PAGE_SIZE - 1);
    })
  );

  for (const page of pages) {
    if (page.error) throw page.error;
    for (const row of page.data ?? []) {
      const key = `${row.season_number}-${row.episode_number}`;
      const set = bySeriesId.get(row.series_id);
      if (set) set.add(key);
      else bySeriesId.set(row.series_id, new Set([key]));
    }
  }
  return bySeriesId;
}

/**
 * TASK-145 (a pedido — card de "Continue assistindo" em modo lista)
 * — pra cada série "Assistindo", acha o episódio pendente mais
 * antigo (já foi ao ar, ainda não foi marcado) e conta quantos
 * outros também estão pendentes (`additionalPendingCount`, o "+N"
 * do card).
 *
 * AUDITORIA (perf, a pedido) — antes fazia uma chamada de rede A
 * MAIS por série só pra pegar o nome do episódio
 * (`/api/tmdb/episode/{...}`), depois de já ter buscado os
 * episódios em lote. A rota de lote já devolve o nome de cada
 * episódio (mesmo dado, mesma resposta) — sem motivo pra buscar de
 * novo, um por um. Eliminado.
 */
export async function fetchNextEpisodesToWatch(seriesIds: number[]): Promise<Map<number, NextEpisodeToWatch>> {
  const result = new Map<number, NextEpisodeToWatch>();
  if (seriesIds.length === 0) return result;

  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return result;

  const [liveEpisodesBySeriesId, watchedKeysBySeriesId] = await Promise.all([
    fetchLiveEpisodesBySeriesId(seriesIds),
    fetchWatchedEpisodeKeysBySeriesId(user.id, seriesIds),
  ]);

  const today = todayLocalKey();
  const pendingBySeriesId = new Map<number, { seasonNumber: number; episodeNumber: number; name: string; airDate: string | null }[]>();

  for (const seriesId of seriesIds) {
    const liveEpisodes = liveEpisodesBySeriesId.get(seriesId) ?? [];
    const watchedKeys = watchedKeysBySeriesId.get(seriesId) ?? new Set<string>();

    /**
     * CORREÇÃO (bug real, reportado — Tanya the Evil e Daemons do
     * Reino das Sombras, animes em exibição semanal) — antes,
     * `e.airDate !== null` excluía de vez qualquer episódio sem data
     * de exibição conhecida, mesmo que já tivesse ido ao ar de
     * verdade. O TMDB às vezes demora a preencher a data do episódio
     * mais recente de um anime em exibição — o episódio existia,
     * estava disponível, só a `airDate` ainda não tinha chegado.
     * Resultado: episódio pendente de verdade nunca aparecia como
     * "próximo a assistir". Agora só EXCLUI quando a data É
     * CONHECIDA e está no futuro — data desconhecida (`null`) não
     * exclui mais, mesmo espírito da correção já aplicada no web
     * (`ContinueWatchingCard.tsx`).
     *
     * CORREÇÃO 2 (bug NOVO, introduzido pela correção acima —
     * reportado "temporada nova confirmada mas SEM data de
     * lançamento foi pra Continue assistindo à toa") — episódio sem
     * data só conta como "pode já ter saído" se a MESMA temporada
     * tiver pelo menos um outro episódio com data confirmada e já
     * passada. Temporada inteira sem nenhuma data (especulação de
     * futuro, ainda sem estreia) não conta mais — evita mostrar
     * "próximo episódio" de uma temporada que nem tem previsão de
     * estrear ainda.
     */
    const seasonsWithConfirmedAiring = new Set(
      liveEpisodes.filter((e) => e.airDate !== null && e.airDate <= today).map((e) => e.seasonNumber)
    );
    const pending = liveEpisodes
      .filter((e) => (e.airDate !== null && e.airDate <= today) || (e.airDate === null && seasonsWithConfirmedAiring.has(e.seasonNumber)))
      .filter((e) => !watchedKeys.has(`${e.seasonNumber}-${e.episodeNumber}`))
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)
      .map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, name: e.name, airDate: e.airDate }));

    if (pending.length > 0) pendingBySeriesId.set(seriesId, pending);
  }

  for (const [seriesId, pending] of pendingBySeriesId.entries()) {
    const next = pending[0];
    if (!next) continue;
    const watchedKeys = watchedKeysBySeriesId.get(seriesId) ?? new Set<string>();
    const badgeWatchedSet = new Set([...watchedKeys].map((key) => `${seriesId}-${key}`));

    result.set(seriesId, {
      seriesId,
      seasonNumber: next.seasonNumber,
      episodeNumber: next.episodeNumber,
      name: next.name,
      additionalPendingCount: pending.length - 1,
      // Sem data conhecida = sem selo (NOVO/MAIS RECENTE/PREMIERE
      // dependem de saber quando saiu) — mesmo padrão do web.
      badge: next.airDate
        ? computeBadge({ seriesId, seasonNumber: next.seasonNumber, episodeNumber: next.episodeNumber, airDate: next.airDate }, badgeWatchedSet)
        : null,
    });
  }

  return result;
}
