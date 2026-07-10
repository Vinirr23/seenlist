"use client";

import { Tv, PlayCircle, CalendarDays } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { useEpisodesTimeline } from "@/lib/queries/episodes-timeline";
import { useSocialCounts } from "@/lib/queries/social-counts";
import { useUpcomingEpisodes } from "@/lib/queries/upcoming-episodes";
import { formatWatchDuration } from "@/lib/format-duration";
import { BigStatCard } from "./BigStatCard";
import { WeeklyBarChart } from "./WeeklyBarChart";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

/**
 * TASK-054 — auditoria: episodesWatched, seriesWatchMinutes,
 * seriesCompleted, seriesInLibrary, seriesWatching, seriesUpToDate,
 * seriesPaused, seriesWantToWatch, episodesRemaining → todos já
 * existiam em useProfileStats (o último foi adicionado nesta mesma
 * tarefa, mas é derivado de dado já presente por item, zero consulta
 * nova). weeks/averagePerWeek/biggestBingeDay → novo
 * (useEpisodesTimeline). commentsGiven/reviewsGiven/likesGiven →
 * novo (useSocialCounts). "Próximos episódios" → reaproveita
 * useUpcomingEpisodes (já existia pra Home).
 *
 * NÃO implementado, e por quê: "gêneros favoritos"/"emissoras
 * favoritas" exigiriam buscar detalhes completos de cada série da
 * biblioteca no TMDB (LibraryItem não carrega genres/networks, só o
 * resumo) — contraria o princípio já estabelecido no projeto de
 * evitar chamadas desnecessárias ao TMDB. "Futuro tempo assistido"
 * também ficou de fora: o TMDB só revela o PRÓXIMO episódio anunciado
 * de cada série, não uma grade futura completa — um "tempo futuro"
 * calculado em cima disso seria enganoso, não um dado real.
 */
export function StatsSeriesTab() {
  const { data: stats, isLoading: statsLoading } = useProfileStats();
  const { data: timeline, isLoading: timelineLoading } = useEpisodesTimeline();
  const { data: social, isLoading: socialLoading } = useSocialCounts();
  const { groups: upcomingGroups, isLoading: upcomingLoading } = useUpcomingEpisodes();

  if (statsLoading || !stats) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const watchTime = formatWatchDuration(stats.seriesWatchMinutes);
  const upcomingCount = upcomingGroups.reduce((sum, g) => sum + g.episodes.length, 0);
  const estimatedWeeks =
    timeline && timeline.averagePerWeek > 0 ? Math.ceil(stats.episodesRemaining / timeline.averagePerWeek) : null;

  return (
    <div className="space-y-3 pb-4">
      <BigStatCard title="Tempo assistindo séries" value={watchTime.primary} subtext={watchTime.secondary} />

      <div className="grid grid-cols-2 gap-3">
        <BigStatCard title="Episódios assistidos" value={numberFormatter.format(stats.episodesWatched)} />
        <BigStatCard title="Episódios restantes" value={numberFormatter.format(stats.episodesRemaining)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BigStatCard title="Séries adicionadas" value={numberFormatter.format(stats.seriesInLibrary)} />
        <BigStatCard title="Séries assistidas" value={numberFormatter.format(stats.seriesCompleted)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <BigStatCard title="Assistindo" value={numberFormatter.format(stats.seriesWatching + stats.seriesUpToDate)} />
        <BigStatCard title="Interrompidas" value={numberFormatter.format(stats.seriesPaused)} />
        <BigStatCard title="Assistir depois" value={numberFormatter.format(stats.seriesWantToWatch)} />
      </div>

      {!timelineLoading && timeline && timeline.weeks.some((w) => w.count > 0) && (
        <BigStatCard
          title="Episódios por semana (últimas 12 semanas)"
          value={timeline.averagePerWeek.toFixed(1)}
          subtext="média por semana"
        >
          <WeeklyBarChart weeks={timeline.weeks} />
        </BigStatCard>
      )}

      {!timelineLoading && timeline?.biggestBingeDay && (
        <BigStatCard
          title="Maior maratona"
          value={`${timeline.biggestBingeDay.count} episódios`}
          subtext={dateFormatter.format(new Date(`${timeline.biggestBingeDay.date}T00:00:00`))}
        >
          <PlayCircle className="h-5 w-5 text-primary" strokeWidth={2} />
        </BigStatCard>
      )}

      {estimatedWeeks != null && stats.episodesRemaining > 0 && (
        <BigStatCard
          title="Ritmo estimado pra ficar em dia"
          value={`${estimatedWeeks} semana${estimatedWeeks === 1 ? "" : "s"}`}
          subtext="baseado no seu ritmo médio recente"
        >
          <CalendarDays className="h-5 w-5 text-primary" strokeWidth={2} />
        </BigStatCard>
      )}

      {!upcomingLoading && (
        <BigStatCard title="Próximos episódios anunciados" value={numberFormatter.format(upcomingCount)}>
          <Tv className="h-5 w-5 text-primary" strokeWidth={2} />
        </BigStatCard>
      )}

      {!socialLoading && social && (
        <div className="grid grid-cols-3 gap-3">
          <BigStatCard title="Avaliações" value={numberFormatter.format(social.reviewsGiven)} />
          <BigStatCard title="Curtidas" value={numberFormatter.format(social.likesGiven)} />
          <BigStatCard title="Comentários" value={numberFormatter.format(social.commentsGiven)} />
        </div>
      )}
    </div>
  );
}
