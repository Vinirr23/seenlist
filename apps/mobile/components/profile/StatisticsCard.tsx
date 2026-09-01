import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useProfileStats } from "@/lib/useProfileStats";
import { formatWatchDuration } from "@/lib/profileStats";
import { Text, Skeleton, Glass, GelSurface } from "@/components/ui";
import { PageError } from "../media/PageError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-116 (correção — Perfil) — porta de `StatisticsCard.tsx`.
 * Card com 4 números de prévia — diferente do carrossel de 7
 * (`StatsCarousel`, usado só no perfil PÚBLICO de outra pessoa).
 * "Ver detalhes" leva pra `/profile/stats`, a tela completa com
 * abas Séries/Filmes.
 *
 * Redesign (a pedido, mesmo visual do web) — degradê de verdade via
 * `expo-linear-gradient` (instalado a pedido, precisou de build
 * novo). Ícone por métrica, "Ver detalhes" como pílula preenchida em
 * vez de só a seta. Carregando/erro usam fundo sólido (`cardStatic`)
 * — não faz sentido animar/degradê num estado que nem tem dado pra
 * mostrar ainda.
 *
 * Carrossel (a pedido — "quero essas estatísticas apareçam como
 * carrossel") — as mesmas 4 estatísticas, agora em scroll horizontal
 * em vez de grade 2×2. O toque pra abrir `/profile/stats` ficou só
 * na pílula "Ver detalhes" do cabeçalho (não no card inteiro como
 * antes) — um `Pressable` cobrindo o carrossel inteiro brigaria com
 * o gesto de arrastar da `ScrollView` por baixo.
 */
export function StatisticsCard() {
  const router = useRouter();
  const { stats, isLoading, isError, refetch } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading) {
    return (
      <View style={[styles.card, styles.cardStatic]}>
        <View style={styles.header}>
          <Skeleton width={120} height={16} />
        </View>
        <View style={styles.carousel}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.carouselItem}>
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
      <View style={[styles.card, styles.cardStatic]}>
        <PageError message={t("profile.errorLoadStats")} onRetry={() => refetch()} />
      </View>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes, t);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes, t);

  const preview: { label: string; value: string; icon: keyof typeof Feather.glyphMap }[] = [
    { label: t("profile.stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched), icon: "tv" },
    { label: t("profile.stats.moviesWatched"), value: numberFormatter.format(stats.moviesCompleted), icon: "film" },
    { label: t("profile.stats.timeWatchingSeries"), value: seriesTime.primary, icon: "clock" },
    { label: t("profile.stats.timeWatchingMovies"), value: movieTime.primary, icon: "video" },
  ];

  return (
    <Glass style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="bar-chart-2" size={16} color={colors.primary} />
          <Text variant="label">{t("profile.statistics")}</Text>
        </View>
        <Pressable onPress={() => router.push("/profile/stats")}>
          <GelSurface style={styles.pillButton}>
            <Text style={styles.pillButtonText}>{t("profile.viewDetails")}</Text>
            <Feather name="chevron-right" size={12} color={colors.background} />
          </GelSurface>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {preview.map((item) => (
          <Glass key={item.label} style={styles.carouselItem}>
            <Feather name={item.icon} size={16} color={colors.secondary} />
            <Text style={styles.value}>{item.value}</Text>
            <Text variant="muted" style={styles.label}>
              {item.label}
            </Text>
          </Glass>
        ))}
      </ScrollView>
    </Glass>
  );
}

const styles = StyleSheet.create({
  skeletonLabel: {
    marginTop: 4,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardStatic: {
    backgroundColor: colors.surface,
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
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  pillButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.background,
  },
  carousel: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  carouselItem: {
    width: 108,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  value: {
    marginTop: 2,
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    fontSize: 11,
  },
});
