import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NextEpisodeToAir } from "@/lib/tmdb/client";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { useLibraryItems } from "./library";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
/** TASK-051 — "episódio acabou de ser lançado" pro badge NOVO. TMDB não define isso; escolhi 7 dias como corte razoável de "recém-lançado", documentado aqui — sem constraint nenhuma no banco, só uma decisão de UI. */
const RECENTLY_AIRED_DAYS = 7;

export type UpcomingBadge = "premiere" | "novo" | "mais-recente" | null;

export interface UpcomingEpisodeWithBadge extends NextEpisodeToAir {
  badge: UpcomingBadge;
  /** Porta de `upcomingEpisodes.ts` do mobile — dias a partir de hoje (0 = hoje, 1 = amanhã...). Usado pro selo "N DIAS" no grupo "DEPOIS", pra não confundir "esta quinta" com "quinta que vem". */
  daysUntil: number;
}

export interface UpcomingGroup {
  /** yyyy-mm-dd, pra ordenar corretamente. */
  dateKey: string;
  /** "HOJE", "AMANHÃ" ou o nome curto do dia ("SEXTA"), já formatado. */
  label: string;
  episodes: UpcomingEpisodeWithBadge[];
}

async function fetchUpcoming(seriesIds: number[]): Promise<NextEpisodeToAir[]> {
  if (seriesIds.length === 0) return [];

  const response = await fetch("/api/tmdb/upcoming", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesIds }),
  });
  if (!response.ok) throw new Error("upcoming fetch failed");

  const data = (await response.json()) as { episodes: NextEpisodeToAir[] };
  return data.episodes;
}

/**
 * TASK-051 — pra decidir o badge NOVO ("ainda não foi assistido"),
 * precisa saber se o episódio específico já está em
 * `watched_episodes`. Isso não existia antes nesta tela — é consulta
 * nova, mas necessária (não dá pra decidir sem esse dado) e mínima:
 * só os pares (série, temporada, episódio) que já vão aparecer na
 * lista, não a tabela inteira.
 */
async function fetchWatchedStatus(
  episodes: NextEpisodeToAir[]
): Promise<Set<string>> {
  if (episodes.length === 0) return new Set();

  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return new Set();

  const orFilter = episodes
    .map((e) => `and(series_id.eq.${e.seriesId},season_number.eq.${e.seasonNumber},episode_number.eq.${e.episodeNumber})`)
    .join(",");

  const { data, error } = await supabase
    .from("watched_episodes")
    .select("series_id, season_number, episode_number")
    .eq("user_id", user.id)
    .or(orFilter);

  if (error) {
    console.error("[upcoming-episodes] Falha ao buscar status assistido — badge NOVO fica sem efeito desta vez.", error);
    return new Set();
  }

  return new Set(data.map((row) => `${row.series_id}-${row.season_number}-${row.episode_number}`));
}

/**
 * TASK-051 — as 3 badges, exatamente como especificado:
 * PREMIERE (episódio 1 de temporada > 1) tem prioridade; depois NOVO
 * (já lançado há até 7 dias e ainda não assistido); depois MAIS
 * RECENTE (já lançado, mas não se encaixa nas duas anteriores —
 * ou porque já foi assistido, ou porque passou da janela de "recém-
 * lançado"). Episódio genuinamente futuro (ainda não foi ao ar) não
 * ganha nenhuma das três — é só "próximo", o agrupamento por dia já
 * deixa isso claro.
 */
export interface BadgeableEpisode {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  airDate: string;
}

/**
 * TASK-055 — exportado pra ser reutilizado por "Continue assistindo"
 * também (mesma regra de badge, dado diferente — próximo episódio
 * não assistido, não o próximo a ir ao ar). Mesma função, sem
 * duplicar a regra em dois lugares.
 */
/**
 * Extraído de dentro de `computeBadge` (mesma comparação de data,
 * "hoje" local) pra ser reaproveitado por quem precisa só saber "já
 * foi ao ar?" sem precisar do cálculo de badge inteiro — caso do
 * `ContinueWatchingCard`, que precisa decidir se chegou a hora de
 * mostrar o card, não só qual selo mostrar.
 */
export function hasEpisodeAired(airDate: string | null): boolean {
  if (!airDate) return false;
  const parsed = new Date(`${airDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() <= today.getTime();
}

export function computeBadge(episode: BadgeableEpisode, watchedKeys: Set<string>): UpcomingBadge {
  if (episode.episodeNumber === 1 && episode.seasonNumber > 1) return "premiere";

  const airDate = new Date(`${episode.airDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alreadyAired = airDate.getTime() <= today.getTime();
  if (!alreadyAired) return null;

  const daysSinceAired = Math.floor((today.getTime() - airDate.getTime()) / (24 * 60 * 60 * 1000));
  const isWatched = watchedKeys.has(`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`);

  if (daysSinceAired <= RECENTLY_AIRED_DAYS && !isWatched) return "novo";
  return "mais-recente";
}


const WEEKDAY_SHORT = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
/** Porta de `upcomingEpisodes.ts` do mobile — a partir do 7º dia, "SEXTA" fica ambíguo (podia ser essa semana ou a que vem). Vira o grupo "DEPOIS", com contagem de dias exata por card em vez de nome de dia da semana. */
const AMBIGUOUS_AFTER_DAYS = 6;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(target: Date, today: Date): number {
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * TASK-023, item 2 (ajuste — porta do mobile): "HOJE" e "AMANHÃ" nos
 * dois primeiros dias, nome curto do dia da semana até o 6º dia
 * ("SEXTA", não "SEXTA-FEIRA"), e a partir do 7º dia vira "DEPOIS"
 * (grupo catch-all só, sem ambiguidade de "qual sexta é essa").
 */
function formatDayLabel(daysUntil: number, dateKey: string): string {
  if (daysUntil === 0) return "HOJE";
  if (daysUntil === 1) return "AMANHÃ";
  if (daysUntil <= AMBIGUOUS_AFTER_DAYS) {
    // "T00:00:00" evita o fuso horário local empurrar a data pro dia anterior.
    const target = startOfDay(new Date(`${dateKey}T00:00:00`));
    return WEEKDAY_SHORT[target.getDay()] ?? "";
  }
  return "DEPOIS";
}

/**
 * TASK-019 — aba "Em breve". TASK-023: "Assistir depois" e
 * "Concluído" ficam de fora (item 1; antes o filtro incluía
 * "Assistir depois" por engano, junto com qualquer coisa que não
 * fosse "completed"). Reaproveita `useLibraryItems` (mesma query da
 * Biblioteca/Perfil, "reutilizar hooks existentes") — nenhuma tabela
 * nova, nenhuma query nova ao Supabase.
 *
 * Correção (bug real, comprovado): o filtro só aceitava
 * status === "watching", mas "Em dia" é um status PRÓPRIO
 * (`up_to_date`, ver `LibraryTabs.tsx`), não uma variação de
 * "watching". Como qualquer série acompanhada de perto vira
 * "up_to_date" assim que o usuário assiste o que já saiu, a aba "Em
 * breve" ficava vazia justamente para as séries mais ativas — só
 * sobravam as poucas ainda atrasadas em "watching". "Em dia" e
 * "Assistindo" são os dois estados de quem está acompanhando a
 * série ativamente; ambos devem aparecer aqui.
 */
export function useUpcomingEpisodes() {
  const libraryQuery = useLibraryItems();

  const seriesIds = useMemo(
    () =>
      (libraryQuery.data ?? [])
        .filter(
          (item) =>
            item.mediaType === "series" &&
            (item.status === "watching" || item.status === "up_to_date")
        )
        .map((item) => item.id),
    [libraryQuery.data]
  );

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-episodes", seriesIds.slice().sort((a, b) => a - b).join(",")],
    queryFn: () => fetchUpcoming(seriesIds),
    enabled: !libraryQuery.isLoading,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });

  const watchedQuery = useQuery({
    queryKey: ["upcoming-episodes-watched", (upcomingQuery.data ?? []).map((e) => `${e.seriesId}-${e.seasonNumber}-${e.episodeNumber}`).join(",")],
    queryFn: () => fetchWatchedStatus(upcomingQuery.data ?? []),
    enabled: !upcomingQuery.isLoading && (upcomingQuery.data?.length ?? 0) > 0,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });

  const groups = useMemo<UpcomingGroup[]>(() => {
    const episodes = upcomingQuery.data ?? [];
    const watchedKeys = watchedQuery.data ?? new Set<string>();
    const today = startOfDay(new Date());
    const byGroupKey = new Map<string, { label: string; episodes: UpcomingEpisodeWithBadge[] }>();

    for (const episode of episodes) {
      const target = startOfDay(new Date(`${episode.airDate}T00:00:00`));
      const daysUntil = daysBetween(target, today);
      const label = formatDayLabel(daysUntil, episode.airDate);
      // "DEPOIS" é um grupo só, catch-all; os outros continuam um grupo por dia.
      const groupKey = label === "DEPOIS" ? "depois" : episode.airDate;

      const withBadge: UpcomingEpisodeWithBadge = { ...episode, badge: computeBadge(episode, watchedKeys), daysUntil };
      const group = byGroupKey.get(groupKey);
      if (group) {
        group.episodes.push(withBadge);
      } else {
        byGroupKey.set(groupKey, { label, episodes: [withBadge] });
      }
    }

    return [...byGroupKey.entries()]
      .sort(([a], [b]) => {
        if (a === "depois") return 1; // "DEPOIS" sempre por último
        if (b === "depois") return -1;
        return a.localeCompare(b);
      })
      .map(([dateKey, group]) => ({
        dateKey,
        label: group.label,
        episodes: group.episodes.sort((a, b) => a.daysUntil - b.daysUntil),
      }));
  }, [upcomingQuery.data, watchedQuery.data]);

  return {
    groups,
    isLoading: libraryQuery.isLoading || upcomingQuery.isLoading,
    isError: libraryQuery.isError || upcomingQuery.isError,
    error: libraryQuery.error ?? upcomingQuery.error,
  };
}