import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useProfileStats } from "@/lib/useProfileStats";
import { fetchEpisodesTimeline, type EpisodesTimeline } from "@/lib/episodesTimeline";
import { useSocialCounts } from "@/lib/useCurrentUser";
import { useUpcomingEpisodes } from "@/lib/useUpcomingEpisodes";
import { formatWatchDuration } from "@/lib/profileStats";
import { BigStatCard } from "./BigStatCard";
import { WeeklyBarChart } from "./WeeklyBarChart";
import { colors, spacing } from "@/lib/theme";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });

/**
 * TASK-117 — porta fiel de `StatsSeriesTab.tsx`. Mesma auditoria do
 * web documentada lá: "gêneros/emissoras favoritas" e "tempo futuro
 * assistido" NÃO entram — exigiriam detalhe completo de cada série
 * no TMDB (fora do que a Biblioteca já carrega) ou inventariam um
 * dado que o TMDB não garante (só o PRÓXIMO episódio anunciado, não
 * uma grade futura completa).
 */
export function StatsSeriesTab() {
  const { session } = useAuth();
  const { stats, isLoading: statsLoading } = useProfileStats();
  const [timeline, setTimeline] = useState<EpisodesTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const social = useSocialCounts(session?.user.id ?? null);
  const { groups: upcomingGroups, isLoading: upcomingLoading } = useUpcomingEpisodes();

  useEffect(() => {
    fetchEpisodesTimeline()
      .then(setTimeline)
      .catch((error) => console.error("[StatsSeriesTab] Falha ao buscar linha do tempo", error))
      .finally(() => setTimelineLoading(false));
  }, []);

  if (statsLoading || !stats) {
    return (
      <View style={styles.skeletonList}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  const watchTime = formatWatchDuration(stats.seriesWatchMinutes);
  const upcomingCount = upcomingGroups.reduce((sum, g) => sum + g.episodes.length, 0);
  const estimatedWeeks = timeline && timeline.averagePerWeek > 0 ? Math.ceil(stats.episodesRemaining / timeline.averagePerWeek) : null;

  return (
    <View style={styles.list}>
      <BigStatCard title="Tempo assistindo séries" value={watchTime.primary} subtext={watchTime.secondary} />

      <View style={styles.row2}>
        <View style={styles.flex1}>
          <BigStatCard title="Episódios assistidos" value={numberFormatter.format(stats.episodesWatched)} />
        </View>
        <View style={styles.flex1}>
          <BigStatCard title="Episódios restantes" value={numberFormatter.format(stats.episodesRemaining)} />
        </View>
      </View>

      <View style={styles.row2}>
        <View style={styles.flex1}>
          <BigStatCard title="Séries adicionadas" value={numberFormatter.format(stats.seriesInLibrary)} />
        </View>
        <View style={styles.flex1}>
          <BigStatCard title="Séries assistidas" value={numberFormatter.format(stats.seriesCompleted)} />
        </View>
      </View>

      <View style={styles.row3}>
        <View style={styles.flex1}>
          <BigStatCard title="Assistindo" value={numberFormatter.format(stats.seriesWatching + stats.seriesUpToDate)} />
        </View>
        <View style={styles.flex1}>
          <BigStatCard title="Interrompidas" value={numberFormatter.format(stats.seriesPaused)} />
        </View>
        <View style={styles.flex1}>
          <BigStatCard title="Assistir depois" value={numberFormatter.format(stats.seriesWantToWatch)} />
        </View>
      </View>

      {!timelineLoading && timeline && timeline.weeks.some((w) => w.count > 0) && (
        <BigStatCard title="Episódios por semana (últimas 12 semanas)" value={timeline.averagePerWeek.toFixed(1)} subtext="média por semana">
          <WeeklyBarChart weeks={timeline.weeks} />
        </BigStatCard>
      )}

      {!timelineLoading && timeline?.biggestBingeDay && (
        <BigStatCard
          title="Maior maratona"
          value={`${timeline.biggestBingeDay.count} episódios`}
          subtext={dateFormatter.format(new Date(`${timeline.biggestBingeDay.date}T00:00:00`))}
        >
          <Feather name="play-circle" size={18} color={colors.primary} />
        </BigStatCard>
      )}

      {estimatedWeeks != null && stats.episodesRemaining > 0 && (
        <BigStatCard title="Ritmo estimado pra ficar em dia" value={`${estimatedWeeks} semana${estimatedWeeks === 1 ? "" : "s"}`} subtext="baseado no seu ritmo médio recente">
          <Feather name="calendar" size={18} color={colors.primary} />
        </BigStatCard>
      )}

      {!upcomingLoading && (
        <BigStatCard title="Próximos episódios anunciados" value={numberFormatter.format(upcomingCount)}>
          <Feather name="tv" size={18} color={colors.primary} />
        </BigStatCard>
      )}

      {!!social && (
        <View style={styles.row3}>
          <View style={styles.flex1}>
            <BigStatCard title="Avaliações" value={numberFormatter.format(social.reviewsGiven)} />
          </View>
          <View style={styles.flex1}>
            <BigStatCard title="Curtidas" value={numberFormatter.format(social.likesGiven)} />
          </View>
          <View style={styles.flex1}>
            <BigStatCard title="Comentários" value={numberFormatter.format(social.commentsGiven)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row2: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  row3: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  flex1: {
    flex: 1,
  },
  skeletonList: {
    gap: spacing.sm,
  },
  skeleton: {
    height: 96,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
});
