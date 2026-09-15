import { useState } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { StatsSeriesTab } from "@/components/profile/StatsSeriesTab";
import { StatsMoviesTab } from "@/components/profile/StatsMoviesTab";
import { Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
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
  const router = useRouter();
  const [tab, setTab] = useState<StatsTab>("series");
  const { t } = useTranslation();

  return (
    <Screen padded={false}>
      {/* `bottomInset` saiu: a barra de navegação agora flutua sobre esta tela (ver `app/_layout.tsx`) e a folga do fim do conteúdo já soma a área segura, via `useTabBarClearance()`. Manter os dois empurrava o conteúdo pra cima duas vezes e ainda tirava o fundo de trás da barra, que é o que dá o efeito de vidro. */}
      {/*
        * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem alguma
        * pendência de design", 2026-09-16) — título "Estatísticas" e
        * as duas abas "Séries"/"Filmes" estavam com texto fixo em
        * português; web usa `t("profile.statistics")`/`t("nav.series")`/
        * `t("nav.movies")` — as 3 chaves já existem traduzidas nas 3
        * línguas em `translations.ts`, só reaproveitadas aqui.
        */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("profile.statistics")}</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tabButton, tab === "series" && styles.tabButtonActive]} onPress={() => setTab("series")}>
          <Text style={tab === "series" ? styles.tabLabelActive : styles.tabLabel}>{t("nav.series")}</Text>
        </Pressable>
        <Pressable style={[styles.tabButton, tab === "movies" && styles.tabButtonActive]} onPress={() => setTab("movies")}>
          <Text style={tab === "movies" ? styles.tabLabelActive : styles.tabLabel}>{t("nav.movies")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>{tab === "series" ? <StatsSeriesTab /> : <StatsMoviesTab />}</ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
  },
  tabLabelActive: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
