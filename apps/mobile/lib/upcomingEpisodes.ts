import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchLibraryItems } from "@/lib/library";
import { todayLocalKey } from "@/lib/localDate";

const SITE_URL = "https://seenlist.app";
const RECENTLY_AIRED_DAYS = 7;

export interface NextEpisodeToAir {
  seriesId: number;
  seriesTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string;
  networks: string[];
}

export type UpcomingBadge = "premiere" | "novo" | "mais-recente" | "em-breve" | null;

export interface UpcomingEpisodeWithBadge extends NextEpisodeToAir {
  badge: UpcomingBadge;
  /** TASK-147 — dias a partir de hoje (0 = hoje, 1 = amanhã...). Usado pro selo "N DIAS" no grupo "DEPOIS", pra não confundir "esta quinta" com "quinta que vem". */
  daysUntil: number;
}

export interface UpcomingGroup {
  dateKey: string;
  label: string;
  episodes: UpcomingEpisodeWithBadge[];
}

async function fetchUpcoming(seriesIds: number[]): Promise<NextEpisodeToAir[]> {
  if (seriesIds.length === 0) return [];
  const response = await fetch(`${SITE_URL}/api/tmdb/upcoming`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesIds }),
  });
  if (!response.ok) throw new Error("upcoming fetch failed");
  const data = (await response.json()) as { episodes: NextEpisodeToAir[] };
  return data.episodes;
}

async function fetchWatchedStatus(episodes: NextEpisodeToAir[]): Promise<Set<string>> {
  if (episodes.length === 0) return new Set();
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return new Set();

  const orFilter = episodes
    .map((e) => `and(series_id.eq.${e.seriesId},season_number.eq.${e.seasonNumber},episode_number.eq.${e.episodeNumber})`)
    .join(",");

  const { data, error } = await supabase.from("watched_episodes").select("series_id, season_number, episode_number").eq("user_id", user.id).or(orFilter);
  if (error) {
    console.error("[upcomingEpisodes] Falha ao buscar status assistido — badge NOVO fica sem efeito desta vez.", error);
    return new Set();
  }
  return new Set((data ?? []).map((row) => `${row.series_id}-${row.season_number}-${row.episode_number}`));
}

interface BadgeableEpisode {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
}

/**
 * TASK-146 (a pedido — diverge do web de propósito) — web nunca
 * mostra selo em episódio que ainda não foi ao ar (só "premiere",
 * que não depende de data). A pedido, episódio futuro que não é
 * premiere agora ganha "em-breve" em vez de ficar sem selo nenhum.
 */
export function computeBadge(episode: BadgeableEpisode, watchedKeys: Set<string>): UpcomingBadge {
  if (episode.episodeNumber === 1 && episode.seasonNumber > 1) return "premiere";

  const today = todayLocalKey();
  const alreadyAired = episode.airDate <= today;
  if (!alreadyAired) return "em-breve";

  const airDate = new Date(`${episode.airDate}T00:00:00`);
  const todayMidnight = new Date(`${today}T00:00:00`);
  const daysSinceAired = Math.floor((todayMidnight.getTime() - airDate.getTime()) / (24 * 60 * 60 * 1000));
  const isWatched = watchedKeys.has(`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`);
  if (daysSinceAired <= RECENTLY_AIRED_DAYS && !isWatched) return "novo";
  return "mais-recente";
}

const WEEKDAY_SHORT = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const AMBIGUOUS_AFTER_DAYS = 6; // a partir do 7º dia, "quinta" fica ambíguo (podia ser essa semana ou a que vem) — vira o grupo "DEPOIS" com contagem de dias.

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(target: Date, today: Date): number {
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * TASK-147 (a pedido — diferenciar "esta quinta" de "quinta que
 * vem") — diverge do web de propósito: o web só usa nome do dia da
 * semana, sem limite, então "QUINTA" tanto pode ser daqui a 2 dias
 * quanto daqui a 9. A partir do 7º dia, group vira "DEPOIS" — cada
 * card individual mostra "N DIAS" (ver `UpcomingEpisodeCard.tsx`),
 * sem ambiguidade nenhuma.
 */
function formatDayLabel(daysUntil: number, dateKey: string): string {
  if (daysUntil === 0) return "HOJE";
  if (daysUntil === 1) return "AMANHÃ";
  if (daysUntil <= AMBIGUOUS_AFTER_DAYS) {
    const target = startOfDay(new Date(`${dateKey}T00:00:00`));
    return WEEKDAY_SHORT[target.getDay()] ?? "";
  }
  return "DEPOIS";
}

/**
 * TASK-117/119 — porta de `useUpcomingEpisodes` do web. Reaproveitada
 * tanto pela tela de Estatísticas ("Próximos episódios anunciados")
 * quanto pela futura aba "Em breve" de Séries — mesma função, sem
 * duplicar a regra em dois lugares (mesmo espírito do web).
 */
export async function fetchUpcomingGroups(): Promise<UpcomingGroup[]> {
  const items = await fetchLibraryItems();
  const seriesIds = items.filter((item) => item.mediaType === "series" && (item.status === "watching" || item.status === "up_to_date")).map((item) => item.id);

  const episodes = await fetchUpcoming(seriesIds);
  const watchedKeys = await fetchWatchedStatus(episodes);
  const today = startOfDay(new Date());

  const byGroupKey = new Map<string, { label: string; episodes: UpcomingEpisodeWithBadge[] }>();
  for (const episode of episodes) {
    const target = startOfDay(new Date(`${episode.airDate}T00:00:00`));
    const daysUntil = daysBetween(target, today);
    const label = formatDayLabel(daysUntil, episode.airDate);
    const groupKey = label === "DEPOIS" ? "depois" : episode.airDate; // "DEPOIS" é um grupo só, catch-all; os outros continuam um grupo por dia.

    const withBadge: UpcomingEpisodeWithBadge = { ...episode, badge: computeBadge(episode, watchedKeys), daysUntil };
    const group = byGroupKey.get(groupKey);
    if (group) group.episodes.push(withBadge);
    else byGroupKey.set(groupKey, { label, episodes: [withBadge] });
  }

  return [...byGroupKey.entries()]
    .sort(([a], [b]) => {
      if (a === "depois") return 1; // "DEPOIS" sempre por último
      if (b === "depois") return -1;
      return a.localeCompare(b);
    })
    .map(([dateKey, group]) => ({ dateKey, label: group.label, episodes: group.episodes.sort((a, b) => a.daysUntil - b.daysUntil) }));
}
