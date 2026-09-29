import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { FollowListUser } from "@/lib/followList";
import { Text, Glass } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * PORTE DO WEB (2026-09-04, "vidro que falta") — a linha virou
 * "glass-row" (web, `UserListRow.tsx`: `rounded-2xl border
 * border-white/10 px-3.5 py-3 backdrop-blur`), no lugar da linha crua
 * sem card nenhum. A borda de tela (`paddingHorizontal`) que morava
 * AQUI passou pro `contentContainerStyle` da lista em
 * `app/follow-list/[userId]/[direction].tsx` — agora que cada linha é
 * um cartão, ela precisa do respiro por fora, não por dentro.
 */
export function FollowListRow({ user }: { user: FollowListUser }) {
  const router = useRouter();
  const { t } = useTranslation();
  const displayName = user.displayName || user.username;

  return (
    <Pressable onPress={() => router.push(`/u/${user.username}`)}>
      <Glass style={styles.row}>
        <Avatar uri={user.avatarUrl} name={displayName} style={styles.avatar} textStyle={styles.avatarInitials} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {displayName}
            </Text>
            <VerifiedBadge tier={user.verifiedTier} size={fontSize.sm} />
          </View>
          <Text numberOfLines={1} variant="muted" style={styles.username}>
            @{user.username}
          </Text>
          {user.followsViewer && (
            /* CORREÇÃO (FASE 2, strings hardcoded, 2026-09-26) — era texto literal, sem passar por `t()`. */
            <Text style={styles.followsYou} numberOfLines={1}>
              {t("profile.followsYou")}
            </Text>
          )}
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Padding INTERNO do cartão — web usa `px-3.5 py-3` (14px/12px). A
  // borda de tela saiu daqui (ver docstring do componente).
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  /**
   * FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do
   * usuário: "Unificar em 36px") — era 44/22, o único lugar do app
   * (junto de `app/notifications.tsx`) com esse avatar de linha num
   * tamanho diferente do resto ("Opção B" da Fase 1: 36px, já usado em
   * comentários/posts/atividade/recomendações).
   */
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // FASE 2 (consistência visual sistêmica, Bucket C, 2026-09-26, decisão do
  // usuário) — token formalizado `fontSize.xs` (era `fontSize.sm`=14):
  // unifica com o mesmo papel (iniciais em avatar de 36px) do
  // `PostCommentItem.tsx`/`EpisodeCommentItem.tsx`, que já usam `fontSize.xs`(12).
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
  username: {
    fontSize: fontSize.xs,
  },
  followsYou: {
    marginTop: 2,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
    fontSize: fontSize.xxs,
    color: colors.primary,
  },
});
