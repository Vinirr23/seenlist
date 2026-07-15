import { useEffect, useRef } from "react";
import { ScrollView, View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryStatus, SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { episodeKey, resolveCarouselEpisodes, type EpisodeRef, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import { Text } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export function EpisodeCarousel({
  seriesId,
  category,
  seasons,
  watched,
  onToggleEpisode,
}: {
  seriesId: number;
  category: LibraryStatus | null | undefined;
  seasons: SeriesDetails["seasons"];
  watched: Set<WatchedEpisodeKey>;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
}) {
  const items = resolveCarouselEpisodes(category, seasons, watched);
  const scrollRef = useRef<ScrollView>(null);
  const lastAutoScrolledSeriesId = useRef<number | null>(null);

  /**
   * TASK-157/158 (correção — não rolava ao trocar de série) — ao
   * abrir a tela, a lista horizontal de episódios já abre
   * posicionada no primeiro episódio ainda não marcado como
   * assistido, em vez de sempre começar do episódio 1.
   *
   * Correção: a versão anterior usava um "já rolei uma vez" GLOBAL
   * (`useRef(false)`) — mas o Expo Router não remonta esse
   * componente ao navegar de uma série pra outra (só troca os
   * parâmetros da rota), então essa variável ficava travada em
   * `true` desde a primeira série aberta na sessão, e nunca mais
   * rolava sozinha pras próximas. Agora guarda o ID da última série
   * que já rolou — só pula a rolagem se for A MESMA série de novo
   * (ex.: reabrir a tela sem trocar), não qualquer série.
   */
  useEffect(() => {
    if (lastAutoScrolledSeriesId.current === seriesId || items.length === 0) return;
    const firstUnwatchedIndex = items.findIndex(({ seasonNumber, episode }) => !watched.has(episodeKey(seasonNumber, episode.episodeNumber)));
    if (firstUnwatchedIndex > 0) {
      const offsetX = firstUnwatchedIndex * (CARD_WIDTH + spacing.sm);
      scrollRef.current?.scrollTo({ x: offsetX, animated: false });
    }
    lastAutoScrolledSeriesId.current = seriesId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, items.length]);

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.title}>
        Episódios
      </Text>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map(({ seasonNumber, episode }) => (
          <EpisodeCarouselCard
            key={`${seasonNumber}-${episode.episodeNumber}`}
            seriesId={seriesId}
            seasonNumber={seasonNumber}
            episode={episode}
            isWatched={watched.has(episodeKey(seasonNumber, episode.episodeNumber))}
            onToggle={() => onToggleEpisode(seasonNumber, episode.episodeNumber)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function EpisodeCarouselCard({
  seriesId,
  seasonNumber,
  episode,
  isWatched,
  onToggle,
}: {
  seriesId: number;
  seasonNumber: number;
  episode: EpisodeRef["episode"];
  isWatched: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const stillUrl = tmdbImageUrl(episode.stillPath, "w185");
  const code = `S${String(seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => router.push(`/episodes/${seriesId}/${seasonNumber}/${episode.episodeNumber}`)}>
        <View style={styles.stillWrapper}>
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.still} resizeMode="cover" />
          ) : (
            <Feather name="film" size={18} color={colors.muted} />
          )}
        </View>
        <Text style={styles.code}>{code}</Text>
        <Text numberOfLines={1} variant="muted" style={styles.name}>
          {episode.name}
        </Text>
      </Pressable>

      <View style={styles.watchedButtonRow}>
        <EpisodeWatchedButton watched={isWatched} onPress={onToggle} size="sm" />
      </View>
    </View>
  );
}

const CARD_WIDTH = 144;

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
  },
  stillWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  still: {
    width: "100%",
    height: "100%",
  },
  code: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text,
  },
  name: {
    fontSize: 11,
  },
  watchedButtonRow: {
    marginTop: spacing.xs,
    alignItems: "flex-start",
  },
});
