import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Screen, Text } from "@/components/ui";
import { colors, spacing, radius, fontSize, fontFamily } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { fetchSeasonRecap, type SeasonRecapData } from "@/lib/seasonRecap";

type ScreenState = "loading" | "error" | { data: SeasonRecapData };

const HERO_HEIGHT = 220;

/**
 * TASK (Resumo da Temporada) — tela cheia do resumo completo
 * (confirmado com o usuário: tela cheia, não bottom sheet — seção 10
 * da auditoria). Título/temporada/`backdropUrl` chegam via parâmetro
 * de rota (o card que navega pra aqui já tem tudo carregado — evita
 * buscar detalhes da série de novo só pra isso, mesmo padrão de
 * `series/[id]/reviews.tsx`).
 *
 * Diferente do card (que fica OCULTO em erro/indisponível, seção 9 da
 * auditoria), esta tela SIM tem loading e erro explícitos com retry —
 * o usuário já tomou a ação de tocar "Ver resumo completo", esperando
 * ver algo.
 *
 * POLIMENTO (2026-10-07, a pedido explícito do usuário após o 1º teste
 * real em produção) — reescrita visual completa:
 * 1. Hero compacto no topo (backdrop + gradiente escuro) substitui o
 *    `ScreenHeader` padrão — ele mesmo documenta "NÃO usar em telas
 *    hero/detail" (ver comentário em `ScreenHeader.tsx`), que é
 *    exatamente este caso agora. Só um botão de voltar sobreposto, sem
 *    duplicar nome da série/temporada em outro cabeçalho.
 * 2. "Em 30 segundos" encolhido — o próprio prompt (ver
 *    `seasonRecapPrompt.ts`, versão 2) já pede um texto bem mais
 *    curto, então a tipografia aqui só precisa refletir isso.
 * 3. "Principais acontecimentos" virou lista numerada — `keyEvents` já
 *    chega como array (ver `SeasonRecapData`), nunca dividido
 *    arbitrariamente aqui.
 * 4. "Onde a temporada terminou" ganhou um contêiner destacado (fundo
 *    levemente tingido com a cor primária) — é o "payoff" da tela.
 * 5. Tab bar escondida nesta rota (ver `app/_layout.tsx`,
 *    `ChromeDeNavegacao`) — só o botão de voltar do hero é necessário.
 * 6. Tipografia do corpo reduzida (fontSize.sm em vez de fontSize.md,
 *    line-height mais justo) — os parágrafos longos ocupavam espaço
 *    vertical demais.
 */
export default function SeasonRecapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { id, season, seriesTitle, backdropUrl } = useLocalSearchParams<{
    id: string;
    season: string;
    seriesTitle?: string;
    backdropUrl?: string;
  }>();
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
    <Screen padded={false} style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top }]}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(11,14,20,0.35)", "rgba(11,14,20,0.82)", colors.background]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.heroText}>
          <Text style={styles.heroBadge}>{t("seasonRecap.heroBadge")}</Text>
          {seriesTitle ? (
            <Text numberOfLines={1} style={styles.heroSeriesTitle}>
              {seriesTitle}
            </Text>
          ) : null}
          <Text style={styles.heroSeasonLabel}>{t("seasonRecap.cardTitle", { season: numericSeason })}</Text>
        </View>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("seasonRecap.sectionThirtySeconds")}</Text>
              <Text style={styles.thirtySecondsBody}>{state.data.inThirtySeconds}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("seasonRecap.sectionKeyEvents")}</Text>
              <View style={styles.timeline}>
                {state.data.keyEvents.map((event, index) => (
                  <View key={index} style={styles.timelineRow}>
                    <Text style={styles.timelineIndex}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text style={styles.timelineBody}>{event}</Text>
                  </View>
                ))}
              </View>
            </View>

            {state.data.whereItEnded ? (
              <View style={[styles.section, styles.endingSection]}>
                <Text style={styles.sectionTitle}>{t("seasonRecap.sectionEnding")}</Text>
                <Text style={styles.endingBody}>{state.data.whereItEnded}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: colors.surface,
    justifyContent: "space-between",
  },
  backButton: {
    marginLeft: spacing.md,
    marginTop: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,14,20,0.55)",
  },
  heroText: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 2,
  },
  heroBadge: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[600],
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroSeriesTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[500],
    color: colors.muted,
  },
  heroSeasonLabel: {
    fontSize: fontSize.lgPlus,
    fontFamily: fontFamily[700],
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
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
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[600],
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Requisito 2 (polimento 2026-10-07) — "Em 30 segundos" visualmente
  // menor que o corpo normal e com leve destaque de itálico/aspas, pra
  // reforçar que é uma leitura rápida e não uma seção "de peso igual"
  // às outras.
  thirtySecondsBody: {
    fontSize: fontSize.sm,
    fontStyle: "italic",
    color: colors.muted,
    lineHeight: fontSize.sm * 1.4,
  },
  // Requisito 3 — lista numerada integrada ao fundo (sem card pesado
  // por item): só uma linha divisória sutil entre itens.
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timelineIndex: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[700],
    color: colors.secondary,
    minWidth: 22,
  },
  timelineBody: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: fontSize.sm * 1.45,
  },
  // Requisito 4 — contêiner destacado pro "payoff" da temporada.
  endingSection: {
    backgroundColor: "rgba(232,163,61,0.1)",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(232,163,61,0.25)",
    padding: spacing.md,
  },
  endingBody: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: fontSize.sm * 1.45,
  },
});
