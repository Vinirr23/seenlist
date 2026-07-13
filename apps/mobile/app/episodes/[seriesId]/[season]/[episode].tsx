import { useEffect, useState } from "react";
import { ScrollView, View, Image, Pressable, Share, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchEpisodePage, type EpisodePageData } from "@/lib/episodeDetails";
import { isEpisodeWatched, toggleEpisodeWatched } from "@/lib/seriesDetails";
import { fetchMyReview, fetchReviewAggregate, upsertReview, type Review, type ReviewAggregate } from "@/lib/social/reviews";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text } from "@/components/ui";
import { EpisodeWatchedButton } from "@/components/series-detail/EpisodeWatchedButton";
import { EpisodeStarRatingRow } from "@/components/episode/EpisodeStarRatingRow";
import { EpisodeMoodPicker } from "@/components/episode/EpisodeMoodPicker";
import { EpisodeWatchedPlatformPicker } from "@/components/episode/EpisodeWatchedPlatformPicker";
import { EpisodeCommentsSection } from "@/components/episode/EpisodeCommentsSection";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-115 — porta do essencial de `EpisodeDetailView.tsx` do web.
 * De propósito, fora desta leva:
 * - "Personagem favorito" — depende de uma API externa de anime
 *   (Jikan/MyAnimeList), uma integração nova que nenhuma outra tela
 *   usa; fica pra uma leva dedicada só a isso.
 * - Navegação por episódio anterior/próximo (swipe no web) — dá pra
 *   entrar depois sem mexer no resto desta tela.
 * - Comentários com resposta aninhada — versão desta leva é lista
 *   plana (ver `EpisodeCommentsSection`).
 */
export default function EpisodeDetailScreen() {
  const router = useRouter();
  const { seriesId, season, episode } = useLocalSearchParams<{ seriesId: string; season: string; episode: string }>();
  const seriesIdStr = String(seriesId);
  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  const [data, setData] = useState<EpisodePageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [watched, setWatched] = useState(false);
  const [watchedLoading, setWatchedLoading] = useState(true);

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [aggregate, setAggregate] = useState<ReviewAggregate>({ average: null, count: 0 });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    fetchEpisodePage(seriesIdStr, seasonNumber, episodeNumber)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        console.error("[EpisodeDetailScreen] Falha ao buscar episódio", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    isEpisodeWatched(seriesIdNum, seasonNumber, episodeNumber).then((value) => {
      if (!cancelled) {
        setWatched(value);
        setWatchedLoading(false);
      }
    });

    const target = { mediaType: "series" as const, mediaId: seriesIdNum, seasonNumber, episodeNumber };
    fetchMyReview(target).then((value) => {
      if (!cancelled) setMyReview(value);
    });
    fetchReviewAggregate(target).then((value) => {
      if (!cancelled) setAggregate(value);
    });

    return () => {
      cancelled = true;
    };
  }, [seriesIdStr, seasonNumber, episodeNumber]);

  const target = { mediaType: "series" as const, mediaId: seriesIdNum, seasonNumber, episodeNumber };

  async function handleToggleWatched() {
    const previous = watched;
    setWatched(!previous);
    try {
      await toggleEpisodeWatched(seriesIdNum, seasonNumber, episodeNumber, previous);
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao marcar/desmarcar", error);
      setWatched(previous);
    }
  }

  async function handleRate(rating: number) {
    setMyReview((current) => (current ? { ...current, rating } : { id: "", userId: "", rating, reviewText: null, containsSpoiler: false, mood: null, watchedPlatform: null, createdAt: new Date().toISOString(), author: { username: "", displayName: null, avatarUrl: null } }));
    try {
      await upsertReview(target, { rating });
      fetchReviewAggregate(target).then(setAggregate);
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar nota", error);
    }
  }

  async function handleSetMood(mood: string | null) {
    setMyReview((current) => (current ? { ...current, mood } : current));
    try {
      await upsertReview(target, { mood });
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar humor", error);
    }
  }

  async function handleSetPlatform(watchedPlatform: string | null) {
    setMyReview((current) => (current ? { ...current, watchedPlatform } : current));
    try {
      await upsertReview(target, { watchedPlatform });
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar plataforma", error);
    }
  }

  async function handleShare() {
    try {
      await Share.share({ message: data?.episode.name ?? "Episódio" });
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao compartilhar", error);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <Text variant="muted">Carregando…</Text>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <Text variant="muted">Não foi possível carregar este episódio agora.</Text>
      </Screen>
    );
  }

  const { episode: ep, watchProviders } = data;
  const stillUrl = tmdbImageUrl(ep.stillPath, "w780");
  const code = `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;

  return (
    <Screen padded={false} bottomInset>
      <ScrollView>
        <View style={styles.banner}>
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={[styles.bannerImage, styles.bannerFallback]} />
          )}
          <View style={styles.bannerOverlay} />
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={18} color={colors.text} />
          </Pressable>
          <Pressable style={styles.shareButton} onPress={handleShare} hitSlop={8}>
            <Feather name="share-2" size={18} color={colors.text} />
          </Pressable>
          <View style={styles.bannerText}>
            <Text style={styles.code}>{code}</Text>
            <Text variant="title" style={styles.episodeName}>
              {ep.name}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.watchedRow}>
            <EpisodeWatchedButton watched={watched} onPress={handleToggleWatched} disabled={watchedLoading} size="lg" />
            <Text variant="label">{watched ? "Assistido" : "Marcar como assistido"}</Text>
          </View>

          {watched && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                Onde você assistiu?
              </Text>
              <EpisodeWatchedPlatformPicker providers={watchProviders} value={myReview?.watchedPlatform ?? null} onChange={handleSetPlatform} />
            </View>
          )}

          {watched && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                Sua nota
              </Text>
              <EpisodeStarRatingRow value={myReview?.rating ?? 0} onChange={handleRate} />
            </View>
          )}

          {watched && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                Como você se sentiu?
              </Text>
              <EpisodeMoodPicker value={myReview?.mood ?? null} onChange={handleSetMood} />
            </View>
          )}

          <View style={styles.communityRow}>
            <Feather name="star" size={16} color={colors.primary} />
            <Text variant="muted" style={styles.communityText}>
              {aggregate.average !== null
                ? `Avaliação da comunidade: ${aggregate.average.toFixed(1)}/5 (${aggregate.count})`
                : "Ainda sem avaliações da comunidade"}
            </Text>
          </View>

          {!!ep.overview && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                Sinopse
              </Text>
              <Text style={styles.overview}>{ep.overview}</Text>
            </View>
          )}

          <View style={styles.section}>
            <EpisodeCommentsSection target={target} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 220,
    backgroundColor: colors.surface,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerFallback: {
    backgroundColor: colors.surface,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,14,20,0.35)",
  },
  backButton: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11,14,20,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11,14,20,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  code: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
  },
  episodeName: {
    color: "#FFFFFF",
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  watchedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    marginBottom: 2,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  communityText: {
    fontSize: 12,
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
