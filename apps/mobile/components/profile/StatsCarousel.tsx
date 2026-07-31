import { ScrollView, View, StyleSheet } from "react-native";
import type { ProfileStats } from "@/lib/profileStats";
import { formatWatchDuration } from "@/lib/profileStats";
import { StatCard } from "./StatCard";
import { PageError } from "../media/PageError";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { spacing } from "@/lib/theme";

export interface StatsCarouselProps {
  stats: ProfileStats | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Perfil próprio mostra "suas estatísticas"; perfil público mostra "as estatísticas deste perfil". */
  ownerLabel?: "own" | "other";
  onRetry?: () => void;
}

/**
 * TASK-108 — porta de `StatsCarousel.tsx` do web. Componente puro
 * (recebe os dados prontos via props) pra ser reaproveitado tanto
 * pelo Perfil próprio quanto pelo Perfil Público, sem duplicar o
 * carrossel inteiro — mesma decisão do web.
 */
export function StatsCarousel({ stats, isLoading, isError, ownerLabel = "own", onRetry }: StatsCarouselProps) {
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text variant="title" style={styles.sectionTitle}>
          {t("profile.statistics")}
        </Text>
        <View style={styles.loadingRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      </View>
    );
  }

  if (isError || !stats) {
    return (
      <View style={styles.section}>
        <Text variant="title" style={styles.sectionTitle}>
          {t("profile.statistics")}
        </Text>
        <PageError message={ownerLabel === "own" ? t("profile.errorLoadStats") : t("profile.errorLoadStatsOther")} onRetry={onRetry} />
      </View>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes, t);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes, t);

  const cards: { icon: React.ComponentProps<typeof StatCard>["icon"]; title: string; value: string; subtext?: string }[] = [
    { icon: "clock", title: t("profile.stats.timeWatchingSeries"), value: seriesTime.primary, subtext: seriesTime.secondary },
    { icon: "film", title: t("profile.stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched) },
    { icon: "video", title: t("profile.stats.timeWatchingMovies"), value: movieTime.primary, subtext: movieTime.secondary },
    { icon: "check-circle", title: t("profile.stats.moviesCompleted"), value: numberFormatter.format(stats.moviesCompleted) },
    { icon: "check-circle", title: t("profile.stats.seriesCompleted"), value: numberFormatter.format(stats.seriesCompleted) },
    { icon: "tv", title: t("profile.stats.seriesInLibrary"), value: numberFormatter.format(stats.seriesInLibrary) },
    { icon: "film", title: t("profile.stats.moviesInLibrary"), value: numberFormatter.format(stats.moviesInLibrary) },
  ];

  return (
    <View style={styles.section}>
      <Text variant="title" style={styles.sectionTitle}>
        {t("profile.statistics")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((card) => (
          <StatCard key={card.title} icon={card.icon} title={card.title} value={card.value} subtext={card.subtext} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  loadingRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  skeletonCard: {
    width: 152,
    height: 110,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
