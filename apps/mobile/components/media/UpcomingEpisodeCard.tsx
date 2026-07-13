import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { UpcomingEpisodeWithBadge, UpcomingBadge } from "@/lib/upcomingEpisodes";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/** Mesmas cores do web: PREMIERE e MAIS RECENTE em branco/preto, NOVO em amarelo (única das três que usa a cor da marca). */
const BADGE_CONFIG: Record<Exclude<UpcomingBadge, null>, { label: string; background: string; text: string }> = {
  premiere: { label: "PREMIERE", background: "#FFFFFF", text: "#000000" },
  novo: { label: "NOVO", background: colors.primary, text: colors.background },
  "mais-recente": { label: "MAIS RECENTE", background: "#FFFFFF", text: "#000000" },
};

function isGenericEpisodeName(name: string, episodeNumber: number): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === `episódio ${episodeNumber}` || normalized === `episode ${episodeNumber}`;
}

export function UpcomingEpisodeCard({ episode }: { episode: UpcomingEpisodeWithBadge }) {
  const router = useRouter();
  const posterUrl = tmdbImageUrl(episode.posterPath, "w185");
  const badge = episode.badge ? BADGE_CONFIG[episode.badge] : null;
  const network = episode.networks[0] ?? null;
  const episodeCode = `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;
  const hasRealEpisodeName = !!episode.name && !isGenericEpisodeName(episode.name, episode.episodeNumber);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/series/${episode.seriesId}`)}>
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <Feather name="film" size={20} color={colors.muted} />
        )}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.seriesTitle}>
          {episode.seriesTitle}
        </Text>
        {!!badge && (
          <View style={[styles.badge, { backgroundColor: badge.background }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        )}
        <Text style={styles.code}>{episodeCode}</Text>
        {hasRealEpisodeName && (
          <Text numberOfLines={1} variant="muted" style={styles.episodeName}>
            {episode.name}
          </Text>
        )}
      </View>

      {!!network && (
        <Text variant="muted" style={styles.network}>
          {network}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  posterWrapper: {
    width: 64,
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  seriesTitle: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  code: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  episodeName: {
    fontSize: 12,
  },
  network: {
    alignSelf: "center",
    fontSize: 11,
  },
});
