import { useEffect, useState } from "react";
import { View, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Screen, Text, Glass } from "@/components/ui";
import { colors, spacing, radius, fontSize, elevation } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACHIEVEMENTS,
  evaluateAndUnlockAchievements,
  fetchAchievementsState,
  progressFor,
  type AchievementsState,
} from "@/lib/achievements";

/**
 * PILOTO — tela DEDICADA de detalhe de uma conquista
 * (`/profile/achievements/[id]`), 2026-10-15. Substitui o antigo
 * modal/bottom-sheet (`achievements.tsx` tinha isso antes) — pedido
 * explícito, referência enviada (mockup do GPT aprovado): tela cheia
 * própria, com seta de voltar flutuante (mesmo estilo de
 * `MovieHeader.tsx`/`SeriesHeader.tsx` — `Glass variant="icon"`,
 * 36×36, canto 12/12), SEM a barra de navegação embaixo (escondida em
 * `app/_layout.tsx`, mesmo mecanismo já usado por `week-review` e
 * `season-recap`) — por isso NÃO usa `<ScreenHeader>` (o próprio
 * componente documenta que não é pra telas hero/detail).
 *
 * Conquistado: emblema grande, nome, descrição, bloco "conquista
 * desbloqueada" com ícone de confirmação, e botão de compartilhar.
 *
 * REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
 * primeiros") — `unlocked`/`progress`/`unlockedAt` vinham de
 * `DEMO_UNLOCKED`/`DEMO_PROGRESS`/`DEMO_UNLOCKED_AT` (sem banco). Ao
 * abrir esta tela, chama `evaluateAndUnlockAchievements` (confere os
 * critérios de verdade no Postgres e grava o que for novo) e depois
 * `fetchAchievementsState` (lê o estado real). A data de desbloqueio
 * agora é a de verdade (`unlocked_at` da tabela `user_achievements`),
 * não mais um campo vazio de propósito.
 *
 * O BOTÃO DE COMPARTILHAR ESTÁ VISÍVEL MAS DESABILITADO DE PROPÓSITO
 * — o app já tem uma infra de compartilhamento (`ShareCardExport.tsx`,
 * usada no Week Review), mas ela foi feita especificamente pra aquele
 * card, não é um encaixe direto aqui. Em vez de simular um
 * compartilhamento (a pedido explícito, "sem simular um
 * compartilhamento bem-sucedido"), deixei desabilitado até decidirmos
 * se vale a pena construir uma versão própria pra emblemas.
 *
 * Bloqueado: emblema cinza grande, nome, bloco de progresso com barra
 * + "X de Y" (reaproveita `achievements.progress`, já traduzido nos 3
 * idiomas), e a explicação de como desbloquear (`requirementKey`) —
 * mesmo texto que já existia no modal antigo, sem inventar um segundo
 * texto diferente só pra bater 100% com a referência visual (ela tinha
 * duas frases parecidas; nosso modelo de dados só tem uma por estado).
 */

const EMPTY_STATE: AchievementsState = {
  unlocked: { maratonista: false, madrugada: false, "amante-de-filmes": false, classicos: false },
  unlockedAt: {},
  moviesWatchedCount: 0,
};

export default function AchievementDetailScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<AchievementsState>(EMPTY_STATE);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      await evaluateAndUnlockAchievements(userId);
      const fresh = await fetchAchievementsState(userId);
      if (!cancelled) setState(fresh);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const achievement = ACHIEVEMENTS.find((item) => item.id === id);

  if (!achievement) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <View style={styles.notFound}>
          <Text variant="muted">{t("achievements.notFound")}</Text>
        </View>
      </Screen>
    );
  }

  const unlocked = state.unlocked[achievement.id];
  const progress = progressFor(achievement, state);
  const ratio = Math.max(0, Math.min(1, progress / achievement.target));
  const unlockedAtRaw = state.unlockedAt[achievement.id];
  const unlockedAtLabel = unlockedAtRaw
    ? new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(unlockedAtRaw)
      )
    : null;

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
        <Image
          source={unlocked ? achievement.colorImage : achievement.lockedImage}
          style={styles.heroImage}
          resizeMode="contain"
        />

        <Text variant="subtitle" style={styles.name}>
          {t(achievement.titleKey)}
        </Text>

        {unlocked ? (
          <>
            <Text variant="muted" style={styles.description}>
              {t(achievement.descriptionKey)}
            </Text>

            <View style={styles.unlockedBlock}>
              <Feather name="check-circle" size={18} color={colors.success} />
              <View style={styles.unlockedTextCol}>
                <Text style={styles.unlockedText}>{t("achievements.unlockedBadge")}</Text>
                {unlockedAtLabel && (
                  <Text variant="muted" style={styles.unlockedDate}>
                    {unlockedAtLabel}
                  </Text>
                )}
              </View>
            </View>

            <Pressable style={styles.shareButton} disabled accessibilityState={{ disabled: true }}>
              <Feather name="share" size={16} color={colors.muted} />
              <Text variant="muted">{t("achievements.shareButton")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text variant="muted" style={styles.description}>
              {t(achievement.requirementKey)}
            </Text>

            <View style={styles.progressBlock}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressHeaderLabel}>{t("achievements.progressLabel")}</Text>
                <Text style={styles.progressHeaderValue}>
                  {t("achievements.progress", { current: progress, total: achievement.target })}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Glass style={styles.backButton} variant="icon">
      <Pressable
        style={styles.backButtonHit}
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Feather name="arrow-left" size={16} color={colors.text} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  backButtonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroImage: {
    width: 220,
    height: 220,
  },
  name: {
    marginTop: spacing.md,
    textAlign: "center",
  },
  description: {
    marginTop: spacing.xs,
    textAlign: "center",
    maxWidth: 300,
  },
  unlockedBlock: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    width: "100%",
    maxWidth: 320,
  },
  unlockedTextCol: {
    flexShrink: 1,
  },
  unlockedText: {
    color: colors.success,
    fontWeight: "600",
    flexShrink: 1,
  },
  unlockedDate: {
    marginTop: 2,
    fontSize: fontSize.xs,
  },
  shareButton: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    width: "100%",
    maxWidth: 320,
    opacity: 0.5,
  },
  progressBlock: {
    marginTop: spacing.lg,
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressHeaderLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
  progressHeaderValue: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  progressTrack: {
    height: 7,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
});
