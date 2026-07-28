"use client";

import { Tv, PlayCircle, CalendarDays } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { useEpisodesTimeline } from "@/lib/queries/episodes-timeline";
import { useSocialCounts } from "@/lib/queries/social-counts";
import { useUpcomingEpisodes } from "@/lib/queries/upcoming-episodes";
import { formatWatchDuration } from "@/lib/format-duration";
import { BigStatCard } from "./BigStatCard";
import { WeeklyBarChart } from "./WeeklyBarChart";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

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
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "long" });

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
      <BigStatCard title={t("profile.stats.timeWatchingSeriesFull")} value={watchTime.primary} subtext={watchTime.secondary} />

      <div className="grid grid-cols-2 gap-3">
        <BigStatCard title={t("profile.stats.episodesWatched")} value={numberFormatter.format(stats.episodesWatched)} />
        <BigStatCard title={t("profile.stats.episodesRemaining")} value={numberFormatter.format(stats.episodesRemaining)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BigStatCard title={t("profile.stats.seriesAdded")} value={numberFormatter.format(stats.seriesInLibrary)} />
        <BigStatCard title={t("profile.stats.seriesWatchedCount")} value={numberFormatter.format(stats.seriesCompleted)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <BigStatCard title={t("media.status.watching")} value={numberFormatter.format(stats.seriesWatching + stats.seriesUpToDate)} />
        <BigStatCard title={t("media.status.paused")} value={numberFormatter.format(stats.seriesPaused)} />
        <BigStatCard title={t("seriesHome.watchlist")} value={numberFormatter.format(stats.seriesWantToWatch)} />
      </div>

      {!timelineLoading && timeline && timeline.weeks.some((w) => w.count > 0) && (
        <BigStatCard
          title={t("profile.stats.episodesPerWeek")}
          value={timeline.averagePerWeek.toFixed(1)}
          subtext={t("profile.stats.averagePerWeek")}
        >
          <WeeklyBarChart weeks={timeline.weeks} />
        </BigStatCard>
      )}

      {!timelineLoading && timeline?.biggestBingeDay && (
        <BigStatCard
          title={t("profile.stats.biggestBinge")}
          value={t("profile.episodeCount", { count: timeline.biggestBingeDay.count })}
          subtext={dateFormatter.format(new Date(`${timeline.biggestBingeDay.date}T00:00:00`))}
        >
          <PlayCircle className="h-5 w-5 text-primary" strokeWidth={2} />
        </BigStatCard>
      )}

      {estimatedWeeks != null && stats.episodesRemaining > 0 && (
        <BigStatCard
          title={t("profile.stats.estimatedPace")}
          value={estimatedWeeks === 1 ? t("profile.weekSingular", { count: estimatedWeeks }) : t("profile.weekPlural", { count: estimatedWeeks })}
          subtext={t("profile.stats.basedOnRecentPace")}
        >
          <CalendarDays className="h-5 w-5 text-primary" strokeWidth={2} />
        </BigStatCard>
      )}

      {!upcomingLoading && (
        <BigStatCard title={t("profile.stats.upcomingEpisodes")} value={numberFormatter.format(upcomingCount)}>
          <Tv className="h-5 w-5 text-primary" strokeWidth={2} />
        </BigStatCard>
      )}

      {!socialLoading && social && (
        <div className="grid grid-cols-3 gap-3">
          <BigStatCard title={t("profile.stats.reviews")} value={numberFormatter.format(social.reviewsGiven)} />
          <BigStatCard title={t("profile.stats.likes")} value={numberFormatter.format(social.likesGiven)} />
          <BigStatCard title={t("profile.comments")} value={numberFormatter.format(social.commentsGiven)} />
        </div>
      )}
    </div>
  );
}
