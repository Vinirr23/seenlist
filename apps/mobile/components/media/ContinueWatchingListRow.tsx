import { useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import type { NextEpisodeToWatch } from "@/lib/nextEpisodeToWatch";
import { toggleEpisodeWatched } from "@/lib/seriesDetails";
import { tmdbImageUrl } from "@/lib/library";
import { EpisodeWatchedButton } from "@/components/series-detail/EpisodeWatchedButton";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const BADGE_CONFIG: Record<"premiere" | "novo" | "mais-recente" | "em-breve", { label: string; background: string; text: string }> = {
  premiere: { label: "PREMIERE", background: "#FFFFFF", text: "#000000" },
  novo: { label: "NOVO", background: colors.primary, text: colors.background },
  "mais-recente": { label: "MAIS RECENTE", background: "#FFFFFF", text: "#000000" },
  "em-breve": { label: "EM BREVE", background: colors.secondary, text: colors.background },
};

/**
 * TASK-145 (a pedido, com exemplo visual) — só aparece em "Continue
 * assistindo" no modo LISTA, quando a série tem um próximo episódio
 * pendente já calculado (`nextEpisode`). Fora esse caso, quem chama
 * cai pro `MediaListRow` comum — ver `series/index.tsx`.
 */
export function ContinueWatchingListRow({
  item,
  nextEpisode,
  onMarkedWatched,
}: {
  item: LibraryItem;
  nextEpisode: NextEpisodeToWatch;
  onMarkedWatched: () => void;
}) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const posterUrl = tmdbImageUrl(item.posterPath, "w185");
  const code = `T${nextEpisode.seasonNumber} | E${String(nextEpisode.episodeNumber).padStart(2, "0")}`;
  const badge = nextEpisode.badge ? BADGE_CONFIG[nextEpisode.badge] : null;

  async function handleMarkWatched() {
    if (marking) return;
    setMarking(true);
    try {
      await toggleEpisodeWatched(nextEpisode.seriesId, nextEpisode.seasonNumber, nextEpisode.episodeNumber, false);
      onMarkedWatched();
    } catch (error) {
      console.error("[ContinueWatchingListRow] Falha ao marcar episódio assistido", error);
    } finally {
      setMarking(false);
    }
  }

  return (
    <View style={styles.row}>
      <Pressable style={styles.posterWrapper} onPress={() => router.push(`/series/${item.id}`)}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <Feather name="film" size={20} color={colors.muted} />
        )}
      </Pressable>

      <View style={styles.info}>
        <Pressable style={styles.seriesPill} onPress={() => router.push(`/series/${item.id}`)}>
          <Text numberOfLines={1} style={styles.seriesPillText}>
            {item.title.toUpperCase()}
          </Text>
          <Feather name="chevron-right" size={12} color={colors.text} />
        </Pressable>

        <Pressable onPress={() => router.push(`/episodes/${item.id}/${nextEpisode.seasonNumber}/${nextEpisode.episodeNumber}`)}>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{code}</Text>
            {nextEpisode.additionalPendingCount > 0 && <Text style={styles.plusBadge}>+{nextEpisode.additionalPendingCount}</Text>}
          </View>
          <Text numberOfLines={1} variant="muted" style={styles.episodeName}>
            {nextEpisode.name}
          </Text>
        </Pressable>

        {!!badge && (
          <View style={[styles.statusBadge, { backgroundColor: badge.background }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        )}
      </View>

      <EpisodeWatchedButton watched={false} onPress={handleMarkWatched} disabled={marking} size="md" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  posterWrapper: {
    width: 56,
    height: 80,
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
  seriesPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  seriesPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  code: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  plusBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  episodeName: {
    fontSize: 12,
    marginTop: 1,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
