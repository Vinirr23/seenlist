import { useEffect, useState } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { StatsSeriesTab } from "@/components/profile/StatsSeriesTab";
import { StatsMoviesTab } from "@/components/profile/StatsMoviesTab";
import { Screen, Text, ScreenHeader, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type StatsTab = "series" | "movies";

/**
 * TASK-117 (correção — Estatísticas) — porta completa de
 * `StatsPageView.tsx`, substituindo a versão provisória da leva
 * anterior (que só reaproveitava o carrossel de 7 cartões). Agora
 * tem as duas abas de verdade, cada uma com seus próprios cálculos
 * (gráfico semanal, maior maratona, ritmo estimado, etc.).
 */
export default function ProfileStatsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const [tab, setTab] = useState<StatsTab>("series");
  const { t } = useTranslation();
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-27, Etapa 3 — bug real reportado:
   * "Minha Jornada... ao trocar de subabas séries e filmes ambas ficam
   * recarregando") — `{tab === "series" ? <StatsSeriesTab /> :
   * <StatsMoviesTab />}` desmontava um e montava o outro a CADA troca,
   * e nenhum dos hooks de dado usados ali (`useProfileStats`,
   * `useUpcomingEpisodes`, a busca de linha do tempo em
   * `StatsSeriesTab`) tem cache — cada remonte refazia tudo do zero.
   * Mesmo fix aplicado em `app/(tabs)/explore.tsx`: monta na primeira
   * visita, depois MANTÉM montado, só escondendo com `display: "none"`.
   */
  const [subAbasVisitadas, setSubAbasVisitadas] = useState<Set<StatsTab>>(() => new Set([tab]));
  useEffect(() => {
    if (!subAbasVisitadas.has(tab)) setSubAbasVisitadas((prev) => new Set(prev).add(tab));
  }, [tab, subAbasVisitadas]);

  return (
    <Screen padded={false}>
      {/* `bottomInset` saiu: a barra de navegação agora flutua sobre esta tela (ver `app/_layout.tsx`) e a folga do fim do conteúdo já soma a área segura, via `useTabBarClearance()`. Manter os dois empurrava o conteúdo pra cima duas vezes e ainda tirava o fundo de trás da barra, que é o que dá o efeito de vidro. */}
      <ScreenHeader title={t("profile.statistics")} />

      {/*
        * CORREÇÃO (bug real, reportado — "nenhuma dessas telas tem as
        * manchas azuis de fundo") — mesma correção de `favorite-series.tsx`
        * (ver comentário lá): `SUBPAGE_GLOW_BLOBS`, já usada em
        * `comments.tsx`/`edit-profile.tsx`.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      <View style={styles.tabs}>
        <Pressable style={[styles.tabButton, tab === "series" && styles.tabButtonActive]} onPress={() => setTab("series")}>
          <Text style={tab === "series" ? styles.tabLabelActive : styles.tabLabel}>{t("nav.series")}</Text>
        </Pressable>
        <Pressable style={[styles.tabButton, tab === "movies" && styles.tabButtonActive]} onPress={() => setTab("movies")}>
          <Text style={tab === "movies" ? styles.tabLabelActive : styles.tabLabel}>{t("nav.movies")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
        {subAbasVisitadas.has("series") && (
          <View key="sub-aba-series" style={tab === "series" ? undefined : styles.subAbaEscondida}>
            <StatsSeriesTab />
          </View>
        )}
        {subAbasVisitadas.has("movies") && (
          <View key="sub-aba-movies" style={tab === "movies" ? undefined : styles.subAbaEscondida}>
            <StatsMoviesTab />
          </View>
        )}
      </ScrollView>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subAbaEscondida: {
    display: "none",
  },
  glassFill: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.sm` (era literal 14, mesmo valor).
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.muted,
  },
  tabLabelActive: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
