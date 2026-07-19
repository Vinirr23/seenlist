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
 *
 * Redesign (a pedido, mesmo visual do web) — sem
 * `expo-linear-gradient` instalado (evita dependência nativa nova),
 * o degradê do web vira um tingimento sólido sutil aqui (fundo
 * dourado bem fraco) — mesma ideia, versão mais simples. Ícone por
 * métrica, e "Ver detalhes" como pílula preenchida em vez de só a
 * seta.
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

  const preview: { label: string; value: string; icon: keyof typeof Feather.glyphMap }[] = [
    { label: "Episódios assistidos", value: numberFormatter.format(stats.episodesWatched), icon: "tv" },
    { label: "Filmes assistidos", value: numberFormatter.format(stats.moviesCompleted), icon: "film" },
    { label: "Tempo vendo séries", value: seriesTime.primary, icon: "clock" },
    { label: "Tempo vendo filmes", value: movieTime.primary, icon: "video" },
  ];

  return (
    <Pressable style={styles.card} onPress={() => router.push("/profile/stats")}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="bar-chart-2" size={16} color={colors.primary} />
          <Text variant="label">Estatísticas</Text>
        </View>
        <View style={styles.pillButton}>
          <Text style={styles.pillButtonText}>Ver detalhes</Text>
          <Feather name="chevron-right" size={12} color={colors.background} />
        </View>
      </View>
      <View style={styles.grid}>
        {preview.map((item) => (
          <View key={item.label} style={styles.gridItem}>
            <View style={styles.gridItemRow}>
              <Feather name={item.icon} size={14} color={colors.secondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.value}>{item.value}</Text>
                <Text variant="muted" style={styles.label}>
                  {item.label}
                </Text>
              </View>
            </View>
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
    backgroundColor: "rgba(232,163,61,0.06)",
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  pillButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.background,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "50%",
    marginBottom: spacing.sm,
    paddingRight: spacing.sm,
  },
  gridItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
