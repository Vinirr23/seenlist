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
 * CORREÇÃO (2026-08-26 — "motor resistente a fusão de temporadas
 * pela TMDB") — companheiro de `useWatchedEpisodes`, EM SEPARADO de
 * propósito: o Set de chaves (temporada-episódio) acima participa de
 * atualização otimista (mutations mexem nele direto, sem esperar o
 * servidor, ver watched-episodes-mutations.ts) — mexer nessa mesma
 * estrutura pra também carregar IDs arriscaria reescrever toda
 * aquela lógica otimista já calibrada, por um ganho que não precisa
 * disso. Este hook é só-leitura: um Set com o ID FIXO da TMDB de
 * cada episódio (não-especial) já assistido, invalidado nos MESMOS
 * pontos que `watchedEpisodesQueryKey` — fica no máximo um instante
 * desatualizado logo após marcar/desmarcar, igual o Set de chaves já
 * ficaria de qualquer forma até o servidor confirmar.
 *
 * Usado como identidade PREFERENCIAL de "assistido?" em
 * `isEpisodeWatched` — sobrevive a uma futura reestruturação de
 * temporadas pela TMDB, diferente da chave (temporada-episódio), que
 * a TMDB pode mudar por baixo dos panos (já mudou, pra várias séries
 * — ver migração 20260907000000_watched_episodes_tmdb_episode_id.sql).
 */
export function watchedEpisodeIdsQueryKey(seriesId: number) {
  return ["watched-episodes", seriesId, "tmdb-ids"] as const;
}

async function fetchWatchedEpisodeIds(seriesId: number): Promise<Set<number>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("tmdb_episode_id")
    .eq("series_id", seriesId)
    .eq("user_id", user.id)
    .eq("is_special", false)
    .not("tmdb_episode_id", "is", null);

  if (error) throw error;

  return new Set((data ?? []).map((row) => row.tmdb_episode_id as number));
}

export function useWatchedEpisodeIds(seriesId: number) {
  return useQuery({
    queryKey: watchedEpisodeIdsQueryKey(seriesId),
    queryFn: () => fetchWatchedEpisodeIds(seriesId),
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

/**
 * CORREÇÃO (2026-08-26 — "motor resistente") — `episodeId` e
 * `watchedEpisodeIds` são opcionais e novos: quando quem chama já
 * tem o ID fixo da TMDB do episódio (`episode.id`) E o Set de IDs
 * assistidos (`useWatchedEpisodeIds`), a checagem por ID vem
 * PRIMEIRO — sobrevive a uma reestruturação de temporadas pela TMDB.
 * Sem esses dois argumentos (chamador antigo, ou dado ainda sem
 * backfill), cai pro comportamento de sempre — nunca quebra quem
 * ainda não foi atualizado.
 */
export function isEpisodeWatched(
  watched: Set<WatchedEpisodeKey> | undefined,
  seasonNumber: number,
  episodeNumber: number,
  episodeId?: number,
  watchedEpisodeIds?: Set<number>
): boolean {
  if (episodeId !== undefined && watchedEpisodeIds?.has(episodeId)) return true;
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
