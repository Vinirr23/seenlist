import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
 * REVERTIDO (2026-09-03, a pedido — "estatísticas, deixa igual web",
 * comparado ao vivo num celular físico) — tinha virado carrossel de
 * rolagem horizontal (pedido anterior, "quero essas estatísticas
 * apareçam como carrossel"), cada item no seu próprio `Glass`
 * (BlurView aninhado) — a 4ª métrica (tempo assistindo filmes) ficava
 * fora da tela, só visível arrastando, e a estrutura toda ficou
 * diferente do card único do web. Voltou a ser uma grade 2×2 (`grid`
 * abaixo) DENTRO do mesmo `Glass` externo do card — igual ao web
 * (`apps/web/components/profile/StatisticsCard.tsx`: `grid grid-cols-2
 * gap-4`, cada item é só ícone + coluna de texto, sem card próprio por
 * item). Toque continua só na pílula "Ver detalhes" — no web também é
 * só o `Link` da pílula, o resto do card não é clicável.
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
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={styles.gridItem}>
              <Skeleton width={16} height={16} style={styles.skeletonIcon} />
              <View style={styles.gridItemText}>
                <Skeleton width={50} height={fontSize.lg} />
                <Skeleton width={90} height={11} style={styles.skeletonLabel} />
              </View>
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
      {/*
        * CORREÇÃO (a pedido, 2026-09-02 — comparação lado a lado com
        * print real do web, "não está igual") — `StatisticsCard.tsx`
        * do web pinta o card com DOIS `radial-gradient`: um branco no
        * canto superior esquerdo, outro azulado no canto inferior
        * direito, por CIMA do vidro neutro. O `Glass` genérico daqui
        * só tem o gradiente neutro (`glass.gradientNeutral`,
        * `Glass.tsx`, igual em todo card do app) — sem essas duas
        * manchas extras, o card ficava mais uniforme/chapado que o
        * web. Camadas extra aqui, iguais ao mesmo ajuste feito nas
        * pílulas de contagem do Perfil (`profile.tsx`) — ajuste no
        * COMPONENTE, `Glass.tsx` continua intocado.
        */}
      <LinearGradient
        colors={["rgba(255,255,255,0.17)", "rgba(255,255,255,0)"]}
        start={{ x: 0.14, y: 0.1 }}
        end={{ x: 0.7, y: 0.65 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(42,127,184,0)", "rgba(42,127,184,0.18)"]}
        start={{ x: 0.35, y: 0.3 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
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
      <View style={styles.grid}>
        {preview.map((item) => (
          <View key={item.label} style={styles.gridItem}>
            {/*
             * CORREÇÃO (a pedido — "perfil não se parece com o web") —
             * era `colors.secondary` (teal). No `StatisticsCard.tsx` do
             * web, TODOS os ícones das 4 métricas usam `text-primary`
             * (âmbar) — decisão documentada explicitamente na sessão do
             * redesign "vidro" (2026-08-21): "Ícones: todos em âmbar,
             * incluindo os de estatísticas que no código original são
             * text-secondary (teal) — mudança deliberada". Esta tela só
             * não tinha recebido essa parte do port ainda.
             */}
            <Feather name={item.icon} size={16} color={colors.primary} />
            <View style={styles.gridItemText}>
              <Text style={styles.value} numberOfLines={1}>
                {item.value}
              </Text>
              {/*
               * CORREÇÃO (2026-09-03, achada comparando print real
               * mobile x web lado a lado, a pedido — "ainda não está
               * igual ao web") — tinha `numberOfLines={1}`, cortava a
               * legenda com "..." ("Episódios assi..", "Tempo vendo
               * ...") sempre que não cabia numa linha só. No
               * `StatisticsCard.tsx` do web, a classe da legenda
               * (`.lbl`/`text-xs text-muted`) NÃO tem `truncate` nem
               * `whitespace-nowrap` — o texto nunca é cortado, só quebra
               * linha se precisar. Aqui cabia numa linha só por acaso,
               * nas dimensões do web; no mobile, com a mesma fonte, não
               * cabia — daí o corte. Removido o limite de linha (deixa
               * quebrar como o CSS real do web permite) em vez de forçar
               * caber numa linha só com fonte menor ou coluna mais larga
               * — isso seria inventar um valor sem base no CSS de
               * verdade.
               */}
              <Text variant="muted" style={styles.label}>
                {item.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `spacing.xs` (4); o web usa `gap-2` (`StatisticsCard.tsx`, "flex items-center gap-2" do cabeçalho) = 8px. */
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  /**
   * CORREÇÃO (2026-09-03, a pedido — "o botão 'ver detalhes' ainda não
   * está igual ao web") — faltava `textTransform: "uppercase"` (web:
   * classe `uppercase`, `StatisticsCard.tsx`) — o texto vinha da
   * tradução em "Ver detalhes" (frase normal) e ficava assim na tela,
   * só o "Editar" (`profile.tsx`, `editButtonText`) já tinha esse
   * ajuste. Ver comentário em `Glass.tsx` (`gelWrap`) pro resto da
   * correção (borda + sombra que faltavam no botão em si).
   */
  pillButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.background,
    textTransform: "uppercase",
  },
  /**
   * Grade 2×2 (ver comentário "REVERTIDO" no topo do arquivo) — igual
   * ao `grid grid-cols-2 gap-4` do web. `flexBasis: "47%"` (não 50%)
   * dá espaço pro `gap` entre colunas sem estourar a linha pra 3
   * colunas em telas estreitas.
   */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    flexBasis: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gridItemText: {
    flex: 1,
    minWidth: 0,
  },
  skeletonIcon: {
    borderRadius: radius.sm,
  },
  value: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era 11; o web usa `text-xs` (`StatisticsCard.tsx`, legenda de cada métrica) = 12px. */
  label: {
    fontSize: fontSize.xs,
  },
});
