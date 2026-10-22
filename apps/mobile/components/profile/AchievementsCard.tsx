import { memo, useCallback, useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text, Skeleton, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ACHIEVEMENTS,
  EMPTY_ACHIEVEMENTS_STATE,
  fetchAchievementsState,
  fetchFeaturedAchievementIds,
  resolveFeaturedAchievements,
  type AchievementId,
  type AchievementsState,
} from "@/lib/achievements";

const BADGE_SIZE = 56;

/**
 * NOVO (2026-10-17, card "Conquistas" de volta pro Perfil — mockup
 * aprovado em 3 cenários: 4+ desbloqueados, poucos desbloqueados, 0
 * desbloqueados). Porta de `ProfileListsPreview.tsx`/`StatisticsCard.tsx`
 * pro mesmo padrão visual (cabeçalho clicável com ícone+título+seta,
 * card único em `Glass`).
 *
 * DECISÃO REGISTRADA (perguntas explícitas ao usuário, 2026-10-17):
 * 1. O card volta pro Perfil (reverte a decisão de 2026-10-16 de
 *    deixar só em Configurações — ver comentário removido em
 *    `app/(tabs)/profile.tsx`).
 * 2. Os até 4 emblemas da linha são ESCOLHA MANUAL do usuário (tela
 *    `/profile/achievements`, botão "Escolher destaques"); até a
 *    primeira escolha, o padrão automático é os últimos desbloqueados
 *    por data (`resolveFeaturedAchievements`, em `lib/achievements.ts`
 *    — a mesma função decide os dois casos, esta tela não duplica a
 *    lógica).
 * 3. SÓ emblemas já desbloqueados aparecem aqui — nunca um bloqueado
 *    com "0/10" (diferente da versão antiga removida, que mostrava os
 *    4 pilotos fixos independente do status). Por isso NENHUM texto de
 *    progresso aparece embaixo de cada emblema — já que só o que está
 *    completo é mostrado, a fração não diria nada de novo (pedido
 *    explícito: "não coloque o '0/10 ou 10/10'").
 * 4. Com 0 desbloqueados, o card continua aparecendo (barra zerada),
 *    sem nenhum ícone — só o texto de incentivo.
 *
 * SEM `evaluateAndUnlockAchievements` aqui — essa chamada (que de fato
 * CONFERE os critérios no Postgres e grava o que for novo) só roda na
 * tela de Conquistas em si (decisão já tomada antes, ver
 * `app/profile/achievements.tsx`); este card só LÊ o estado já
 * calculado, mais barato pra aparecer toda vez que a aba Perfil ganha
 * foco.
 */
export const AchievementsCard = memo(function AchievementsCard() {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [state, setState] = useState<AchievementsState>(EMPTY_ACHIEVEMENTS_STATE);
  const [featuredIds, setFeaturedIds] = useState<AchievementId[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;

      Promise.all([fetchAchievementsState(userId), fetchFeaturedAchievementIds(userId)])
        .then(([fresh, featured]) => {
          if (cancelled) return;
          setState(fresh);
          setFeaturedIds(featured);
        })
        .catch((error) => {
          console.error("[AchievementsCard] Falha ao buscar conquistas", error);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  const total = ACHIEVEMENTS.length;
  const unlockedCount = Object.values(state.unlocked).filter(Boolean).length;
  const percent = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
  const featured = resolveFeaturedAchievements(featuredIds, state);
  const remaining = total - featured.length;

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => router.push("/profile/achievements")}>
        <View style={styles.sectionTitle}>
          <Feather name="award" size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{t("achievements.screenTitle")}</Text>
        </View>
        <View style={styles.seeAll}>
          <Text variant="muted" style={styles.seeAllText}>
            {t("achievements.cardSeeAll")}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </View>
      </Pressable>

      <Glass style={styles.card}>
        {isLoading ? (
          <>
            <Skeleton width="60%" height={14} style={{ marginBottom: spacing.sm }} />
            <Skeleton width="100%" height={6} borderRadius={radius.full} style={{ marginBottom: spacing.md }} />
            <View style={styles.badgeRow}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width={BADGE_SIZE} height={BADGE_SIZE} borderRadius={radius.full} />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {t("achievements.cardUnlockedCount", { current: unlockedCount, total })}
              </Text>
              <Text style={styles.progressPercent}>{percent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>

            {featured.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="award" size={22} color={colors.muted} style={{ opacity: 0.5 }} />
                <Text variant="muted" style={styles.emptyStateText}>
                  {t("achievements.cardEmptyHint")}
                </Text>
              </View>
            ) : (
              <View style={styles.badgeRow}>
                {featured.map((achievement) => (
                  <Pressable
                    key={achievement.id}
                    style={styles.badgeSlot}
                    onPress={() => router.push(`/profile/achievements/${achievement.id}`)}
                  >
                    <Image source={achievement.colorImage} style={styles.badgeImage} resizeMode="contain" />
                    <Text numberOfLines={2} style={styles.badgeName}>
                      {t(achievement.titleKey)}
                    </Text>
                  </Pressable>
                ))}
                {remaining > 0 && (
                  <Pressable style={styles.badgeSlot} onPress={() => router.push("/profile/achievements")}>
                    <View style={styles.remainingCircle}>
                      <Text style={styles.remainingText}>+{remaining}</Text>
                    </View>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )}
      </Glass>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionTitleText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: fontSize.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  progressPercent: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  // Mesmos valores de `progressTrack`/`progressFill` já usados na tela
  // de detalhe (`app/profile/achievements/[id].tsx`) — mesmo
  // componente visual, não reinventado aqui.
  progressTrack: {
    height: 7,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badgeSlot: {
    alignItems: "center",
    width: BADGE_SIZE + spacing.sm,
    gap: spacing.xs,
  },
  badgeImage: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  },
  badgeName: {
    textAlign: "center",
    fontSize: fontSize.micro,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 13,
  },
  remainingCircle: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  remainingText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  emptyStateText: {
    textAlign: "center",
    fontSize: fontSize.xs,
    lineHeight: 17,
    paddingHorizontal: spacing.md,
  },
});
