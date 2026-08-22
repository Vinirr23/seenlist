import { useQuery } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { STALE_TIME_LIBRARY } from "@/lib/queryStaleTimes";

export type WatchedEpisodeKey = `${number}-${number}`; // `${seasonNumber}-${episodeNumber}`

export function episodeKey(seasonNumber: number, episodeNumber: number): WatchedEpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

export function watchedEpisodesQueryKey(seriesId: number) {
  return ["watched-episodes", seriesId] as const;
}

/**
 * CORREÇÃO — mesma causa do erro relatado em series-status: a
 * política de biblioteca pública permite ver watched_episodes de
 * OUTROS usuários com perfil público/seguido. Sem filtrar por
 * user_id aqui, esta consulta (que deveria trazer só os MEUS
 * episódios assistidos) podia silenciosamente misturar episódios de
 * outra pessoa no mesmo Set — sem nem gerar erro, só progresso
 * errado. Isso é provavelmente a explicação real de "mesclou".
 */
async function fetchWatchedEpisodes(seriesId: number): Promise<Set<WatchedEpisodeKey>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id);

  if (error) throw error;

  return new Set(data.map((row) => episodeKey(row.season_number, row.episode_number)));
}

export function useWatchedEpisodes(seriesId: number) {
  return useQuery({
    queryKey: watchedEpisodesQueryKey(seriesId),
    queryFn: () => fetchWatchedEpisodes(seriesId),
    staleTime: STALE_TIME_LIBRARY,
  });
}

/**
 * CORREÇÃO (achado em auditoria — "verifique toda a lógica de
 * status") — mesma causa raiz já corrigida em `seriesCategoryRecalc.ts`/
 * `airDateCategory.ts`, só que aqui pro selo "em dia"/confete de
 * `computeSeriesCaughtUpBadge` (`seriesCaughtUpBadge.ts`): episódio
 * marcado ESPECIAL pelo TV Time (`is_special = true`, pode estar
 * DENTRO de uma temporada normal) nunca era excluído da lista de
 * "episódios que precisam estar assistidos" — se o usuário optou por
 * NÃO marcar aquele especial como assistido na importação (uma opção
 * explícita, ver `SpecialsConfirmationScreen`), o selo/confete nunca
 * aparecia pra essa série, mesmo com tudo o que "conta" assistido.
 */
async function fetchSpecialEpisodeKeys(seriesId: number): Promise<Set<WatchedEpisodeKey>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .eq("is_special", true);

  if (error) throw error;

  return new Set(data.map((row) => episodeKey(row.season_number, row.episode_number)));
}

export function useSpecialEpisodeKeys(seriesId: number) {
  return useQuery({
    queryKey: ["watched-episodes", seriesId, "special-keys"],
    queryFn: () => fetchSpecialEpisodeKeys(seriesId),
    staleTime: STALE_TIME_LIBRARY,
  });
}

export function isEpisodeWatched(
  watched: Set<WatchedEpisodeKey> | undefined,
  seasonNumber: number,
  episodeNumber: number
): boolean {
  return watched?.has(episodeKey(seasonNumber, episodeNumber)) ?? false;
}

export interface MostRecentWatchedEpisode {
  seasonNumber: number;
  episodeNumber: number;
}

async function fetchMostRecentWatchedEpisode(
  seriesId: number
): Promise<MostRecentWatchedEpisode | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .order("watched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return { seasonNumber: data.season_number, episodeNumber: data.episode_number };
}

/** Usado só pelo card "Continuar assistindo" — separado da lista completa pra não acoplar as duas necessidades num hook só. */
export function useMostRecentWatchedEpisode(seriesId: number) {
  return useQuery({
    queryKey: ["watched-episodes", seriesId, "most-recent"],
    queryFn: () => fetchMostRecentWatchedEpisode(seriesId),
    staleTime: STALE_TIME_LIBRARY,
  });
}
