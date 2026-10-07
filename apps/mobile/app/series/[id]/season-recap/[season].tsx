import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, ScreenHeader, Text } from "@/components/ui";
import { colors, spacing, fontSize, fontFamily } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { fetchSeasonRecap, type SeasonRecapData } from "@/lib/seasonRecap";

type ScreenState = "loading" | "error" | { data: SeasonRecapData };

/**
 * TASK (Resumo da Temporada) — tela cheia do resumo completo
 * (confirmado com o usuário: tela cheia, não bottom sheet — seção 10
 * da auditoria). Título/temporada chegam via parâmetro de rota (o
 * card que navega pra aqui já tem tudo carregado — evita buscar
 * detalhes da série de novo só pra isso, mesmo padrão de
 * `series/[id]/reviews.tsx`).
 *
 * Diferente do card (que fica OCULTO em erro/indisponível, seção 9 da
 * auditoria), esta tela SIM tem loading e erro explícitos com retry —
 * o usuário já tomou a ação de tocar "Ver resumo completo", esperando
 * ver algo.
 */
export default function SeasonRecapScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t } = useTranslation();
  const { id, season, seriesTitle } = useLocalSearchParams<{ id: string; season: string; seriesTitle?: string }>();
  const numericId = Number(id);
  const numericSeason = Number(season);

  const [state, setState] = useState<ScreenState>("loading");

  const load = useCallback(() => {
    setState("loading");
    fetchSeasonRecap(numericId, numericSeason).then((data) => {
      setState(data ? { data } : "error");
    });
  }, [numericId, numericSeason]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("seasonRecap.cardTitle", { season: numericSeason })} style={styles.header} />
      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
        {state === "loading" && (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {state === "error" && (
          <View style={styles.centered}>
            <Text variant="muted" style={styles.errorText}>
              {t("seasonRecap.loadError")}
            </Text>
            <Pressable onPress={load} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryLabel}>{t("seasonRecap.retry")}</Text>
            </Pressable>
          </View>
        )}

        {typeof state === "object" && "data" in state && (
          <>
            {seriesTitle ? <Text style={styles.seriesTitle}>{seriesTitle}</Text> : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("seasonRecap.sectionThirtySeconds")}</Text>
              <Text style={styles.sectionBody}>{state.data.inThirtySeconds}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("seasonRecap.sectionKeyEvents")}</Text>
              <Text style={styles.sectionBody}>{state.data.keyEvents}</Text>
            </View>

            {state.data.whereItEnded ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("seasonRecap.sectionEnding")}</Text>
                <Text style={styles.sectionBody}>{state.data.whereItEnded}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.lg * 2,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  retryLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[600],
    color: colors.primary,
  },
  seriesTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily[600],
    color: colors.muted,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[600],
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: fontSize.md * 1.5,
  },
});
