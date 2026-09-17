import { StyleSheet } from "react-native";
import { Text, PressableScale } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function FollowButton({ isFollowing, busy, onPress }: { isFollowing: boolean; busy: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    // CORREÇÃO (2026-09-16, a pedido — "no web, quando aperto algum
    // botão pílula glass, tem uma pequena animação, confere e adiciona
    // também") — conferido no web (`FollowButton.tsx`): `active:scale-
    // [0.96]`. Aqui era `Pressable` puro, sem nenhum feedback de
    // toque — trocado por `PressableScale`.
    <PressableScale style={[styles.button, isFollowing ? styles.following : styles.notFollowing]} onPress={onPress} disabled={busy}>
      <Text style={isFollowing ? styles.followingText : styles.notFollowingText}>
        {isFollowing ? t("profile.following") : t("profile.follow")}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  notFollowing: {
    backgroundColor: colors.primary,
  },
  following: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  notFollowingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.background,
  },
  followingText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },
});
