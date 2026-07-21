import { useState } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { StatsSeriesTab } from "@/components/profile/StatsSeriesTab";
import { StatsMoviesTab } from "@/components/profile/StatsMoviesTab";
import { Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

type StatsTab = "series" | "movies";

/**
 * TASK-117 (correção — Estatísticas) — porta completa de
 * `StatsPageView.tsx`, substituindo a versão provisória da leva
 * anterior (que só reaproveitava o carrossel de 7 cartões). Agora
 * tem as duas abas de verdade, cada uma com seus próprios cálculos
 * (gráfico semanal, maior maratona, ritmo estimado, etc.).
 */
export default function ProfileStatsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<StatsTab>("series");

  return (
    <Screen padded={false} bottomInset>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Estatísticas</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tabButton, tab === "series" && styles.tabButtonActive]} onPress={() => setTab("series")}>
          <Text style={tab === "series" ? styles.tabLabelActive : styles.tabLabel}>Séries</Text>
        </Pressable>
        <Pressable style={[styles.tabButton, tab === "movies" && styles.tabButtonActive]} onPress={() => setTab("movies")}>
          <Text style={tab === "movies" ? styles.tabLabelActive : styles.tabLabel}>Filmes</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>{tab === "series" ? <StatsSeriesTab /> : <StatsMoviesTab />}</ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
