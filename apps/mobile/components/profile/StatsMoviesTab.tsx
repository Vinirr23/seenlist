import { View, StyleSheet } from "react-native";
import { useProfileStats } from "@/lib/useProfileStats";
import { formatWatchDuration } from "@/lib/profileStats";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { BigStatCard } from "./BigStatCard";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-117 — porta de StatsMoviesTab.tsx. Mesma auditoria do web:
 * "filmes restantes" não existe como conceito (filme não tem
 * progresso parcial, é assistido ou não) — não implementado de
 * propósito, não é omissão.
 */
export function StatsMoviesTab() {
  const { stats, isLoading } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading || !stats) {
    return (
      <View style={styles.skeletonList}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  const watchTime = formatWatchDuration(stats.movieWatchMinutes, t);

  return (
    <View style={styles.list}>
      <BigStatCard title={t("profile.stats.timeWatchingMovies")} value={watchTime.primary} subtext={watchTime.secondary} />

      <View style={styles.row2}>
        <View style={styles.flex1}>
          <BigStatCard title={t("profile.stats.moviesWatched")} value={numberFormatter.format(stats.moviesCompleted)} />
        </View>
        <View style={styles.flex1}>
          <BigStatCard title={t("profile.stats.moviesInLibrary")} value={numberFormatter.format(stats.moviesInLibrary)} />
        </View>
      </View>
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
