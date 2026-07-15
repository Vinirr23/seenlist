import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useProfileStats } from "@/lib/useProfileStats";
import { formatWatchDuration } from "@/lib/profileStats";
import { Text, Skeleton } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const numberFormatter = new Intl.NumberFormat("pt-BR");

/**
 * TASK-116 (correção — Perfil) — porta de `StatisticsCard.tsx`.
 * Card único, clicável, com 4 números de prévia — diferente do
 * carrossel de 7 (`StatsCarousel`, usado só no perfil PÚBLICO de
 * outra pessoa). Leva pra `/profile/stats`, a tela completa com
 * abas Séries/Filmes.
 */
export function StatisticsCard() {
  const router = useRouter();
  const { stats, isLoading, isError } = useProfileStats();

  if (isLoading) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Skeleton width={120} height={16} />
        </View>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.gridItem}>
              <Skeleton width={50} height={fontSize.lg} />
              <Skeleton width={90} height={11} style={styles.skeletonLabel} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (isError || !stats) {
    return (
      <View style={styles.card}>
        <Text variant="muted">Não foi possível carregar suas estatísticas agora.</Text>
      </View>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes);

  const preview = [
    { label: "Episódios assistidos", value: numberFormatter.format(stats.episodesWatched) },
    { label: "Filmes assistidos", value: numberFormatter.format(stats.moviesCompleted) },
    { label: "Tempo vendo séries", value: seriesTime.primary },
    { label: "Tempo vendo filmes", value: movieTime.primary },
  ];

  return (
    <Pressable style={styles.card} onPress={() => router.push("/profile/stats")}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="bar-chart-2" size={16} color={colors.primary} />
          <Text variant="label">Estatísticas</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </View>
      <View style={styles.grid}>
        {preview.map((item) => (
          <View key={item.label} style={styles.gridItem}>
            <Text style={styles.value}>{item.value}</Text>
            <Text variant="muted" style={styles.label}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skeletonLabel: {
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "50%",
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    fontSize: 11,
  },
});
