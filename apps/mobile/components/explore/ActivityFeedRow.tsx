import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ActivityItem } from "@/lib/activityFeed";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

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
  const { locale } = useTranslation();
  const timeFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

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
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. Esta linha é
  // renderizada "crua" (sem container com padding) no Explorar, então
  // este `paddingHorizontal` É a borda de tela.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
