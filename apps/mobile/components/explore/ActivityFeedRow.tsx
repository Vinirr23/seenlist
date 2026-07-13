import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { ActivityItem } from "@/lib/activityFeed";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ActivityFeedRow({ item }: { item: ActivityItem }) {
  const router = useRouter();
  const posterUrl = tmdbImageUrl(item.mediaPosterPath, "w185");
  const href = item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`;

  return (
    <Pressable style={styles.row} onPress={() => router.push(href)}>
      <View style={styles.avatar}>
        {item.userAvatarUrl ? (
          <Image source={{ uri: item.userAvatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>{initials(item.userName)}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.line}>
          <Text style={styles.bold}>{item.userName}</Text> {item.action} <Text style={styles.bold}>{item.mediaTitle}</Text>
        </Text>
        <Text variant="muted" style={styles.time}>
          {timeFormatter.format(new Date(item.createdAt))}
        </Text>
      </View>

      {!!posterUrl && (
        <View style={styles.posterWrapper}>
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        </View>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  bold: {
    fontWeight: "700",
  },
  time: {
    marginTop: 2,
    fontSize: 11,
  },
  posterWrapper: {
    width: 32,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
});
