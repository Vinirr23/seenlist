import { ScrollView, View, StyleSheet } from "react-native";
import type { ProfileStats } from "@/lib/profileStats";
import { formatWatchDuration } from "@/lib/profileStats";
import { StatCard } from "./StatCard";
import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

const numberFormatter = new Intl.NumberFormat("pt-BR");

export interface StatsCarouselProps {
  stats: ProfileStats | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Perfil próprio mostra "suas estatísticas"; perfil público mostra "as estatísticas deste perfil". */
  ownerLabel?: "own" | "other";
}

/**
 * TASK-108 — porta de `StatsCarousel.tsx` do web. Componente puro
 * (recebe os dados prontos via props) pra ser reaproveitado tanto
 * pelo Perfil próprio quanto pelo Perfil Público, sem duplicar o
 * carrossel inteiro — mesma decisão do web.
 */
export function StatsCarousel({ stats, isLoading, isError, ownerLabel = "own" }: StatsCarouselProps) {
  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text variant="title" style={styles.sectionTitle}>
          Estatísticas
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
          Estatísticas
        </Text>
        <Text variant="muted">
          {ownerLabel === "own"
            ? "Não foi possível carregar suas estatísticas agora."
            : "Não foi possível carregar as estatísticas deste perfil agora."}
        </Text>
      </View>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes);

  const cards: { icon: React.ComponentProps<typeof StatCard>["icon"]; title: string; value: string; subtext?: string }[] = [
    { icon: "clock", title: "Tempo vendo séries", value: seriesTime.primary, subtext: seriesTime.secondary },
    { icon: "film", title: "Episódios assistidos", value: numberFormatter.format(stats.episodesWatched) },
    { icon: "video", title: "Tempo vendo filmes", value: movieTime.primary, subtext: movieTime.secondary },
    { icon: "check-circle", title: "Filmes concluídos", value: numberFormatter.format(stats.moviesCompleted) },
    { icon: "check-circle", title: "Séries concluídas", value: numberFormatter.format(stats.seriesCompleted) },
    { icon: "tv", title: "Séries na biblioteca", value: numberFormatter.format(stats.seriesInLibrary) },
    { icon: "film", title: "Filmes na biblioteca", value: numberFormatter.format(stats.moviesInLibrary) },
  ];

  return (
    <View style={styles.section}>
      <Text variant="title" style={styles.sectionTitle}>
        Estatísticas
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
