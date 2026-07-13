import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { FollowListUser } from "@/lib/followList";
import { Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function FollowListRow({ user }: { user: FollowListUser }) {
  const router = useRouter();
  const displayName = user.displayName || user.username;

  return (
    <Pressable style={styles.row} onPress={() => router.push(`/u/${user.username}`)}>
      <View style={styles.avatar}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>{initials(displayName)}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>
          {displayName}
        </Text>
        <Text numberOfLines={1} variant="muted" style={styles.username}>
          @{user.username}
        </Text>
        {user.followsViewer && (
          <Text style={styles.followsYou} numberOfLines={1}>
            Segue você
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.muted,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  username: {
    fontSize: 12,
  },
  followsYou: {
    marginTop: 2,
    fontSize: 11,
    color: colors.primary,
  },
});
