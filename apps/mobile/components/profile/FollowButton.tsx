import { Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

export function FollowButton({ isFollowing, busy, onPress }: { isFollowing: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.button, isFollowing ? styles.following : styles.notFollowing]} onPress={onPress} disabled={busy}>
      <Text style={isFollowing ? styles.followingText : styles.notFollowingText}>{isFollowing ? "Seguindo" : "Seguir"}</Text>
    </Pressable>
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
