import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { FollowListUser } from "@/lib/followList";
import { Text, Glass } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

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
  const displayName = user.displayName || user.username;

  return (
    <Pressable onPress={() => router.push(`/u/${user.username}`)}>
      <Glass style={styles.row}>
        <Avatar uri={user.avatarUrl} name={displayName} style={styles.avatar} textStyle={styles.avatarInitials} />
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
