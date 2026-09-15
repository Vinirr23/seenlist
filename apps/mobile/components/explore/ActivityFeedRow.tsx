import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ActivityItem } from "@/lib/activityFeed";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-04, "vidro que falta") — a linha virou
 * "glass-row" (web, `ExploreActivityTab.tsx`: `rounded-2xl border
 * border-white/10 px-3.5 py-3 backdrop-blur`), no lugar da linha crua
 * separada por `border-b`. A borda de tela (`paddingHorizontal`) que
 * morava aqui passou pro `contentContainerStyle` da lista em
 * `app/(tabs)/explore.tsx` — agora que cada linha é um cartão, o
 * respiro precisa ficar por fora dela.
 */
export function ActivityFeedRow({ item }: { item: ActivityItem }) {
  const router = useRouter();
  const posterUrl = tmdbImageUrl(item.mediaPosterPath, "w185");
  const href = item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`;
  const { locale } = useTranslation();
  const timeFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <Pressable onPress={() => router.push(href)}>
      <Glass style={styles.row}>
        <Avatar uri={item.userAvatarUrl} name={item.userName} style={styles.avatar} textStyle={styles.avatarInitials} />

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
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Padding INTERNO do cartão — web usa `px-3.5 py-3` (14px/12px) e
  // `gap-3` (12px). A borda de tela e o separador `border-b` saíram
  // daqui (ver docstring do componente).
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
