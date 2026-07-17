import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Image, Pressable, Share, StyleSheet } from "react-native";
import { Gesture, GestureDetector, type GestureStateChangeEvent, type PanGestureHandlerEventPayload } from "react-native-gesture-handler";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { SeriesDetails } from "@seenlist/types";
import { fetchEpisodePage, type EpisodePageData } from "@/lib/episodeDetails";
import { fetchSeriesDetails, isEpisodeWatched, toggleEpisodeWatched } from "@/lib/seriesDetails";
import { fetchMyReview, fetchReviewAggregate, upsertReview, type Review, type ReviewAggregate } from "@/lib/social/reviews";
import { useEpisodeCommentCount } from "@/lib/social/useEpisodeComments";
import { getAnimeCharacters } from "@/lib/animeCharacters";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text } from "@/components/ui";
import { MediaDetailSkeleton } from "@/components/media/MediaDetailSkeleton";
import { EpisodeWatchedButton } from "@/components/series-detail/EpisodeWatchedButton";
import { EpisodeStarRatingRow } from "@/components/episode/EpisodeStarRatingRow";
import { EpisodeMoodPicker } from "@/components/episode/EpisodeMoodPicker";
import { EpisodeWatchedPlatformPicker } from "@/components/episode/EpisodeWatchedPlatformPicker";
import { EpisodeFavoriteCharacterPicker, type FavoriteCharacterOption } from "@/components/episode/EpisodeFavoriteCharacterPicker";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/** Idêntico a findAdjacentEpisodes do web — mesma lista de temporadas já em cache, sem chamada nova ao TMDB. */
function findAdjacentEpisodes(
  seasons: SeriesDetails["seasons"] | undefined,
  season: number,
  episode: number
): { previous: EpisodeRef | null; next: EpisodeRef | null } {
  if (!seasons) return { previous: null, next: null };

  const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const flat: EpisodeRef[] = sorted.flatMap((s) =>
    [...s.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber).map((e) => ({ seasonNumber: s.seasonNumber, episodeNumber: e.episodeNumber }))
  );

  const currentIndex = flat.findIndex((e) => e.seasonNumber === season && e.episodeNumber === episode);
  if (currentIndex === -1) return { previous: null, next: null };

  return {
    previous: currentIndex > 0 ? (flat[currentIndex - 1] ?? null) : null,
    next: currentIndex < flat.length - 1 ? (flat[currentIndex + 1] ?? null) : null,
  };
}

const SWIPE_THRESHOLD_PX = 60;

/**
 * TASK-115/122 — porta completa de `EpisodeDetailView.tsx` do web,
 * fechando as 3 peças que tinham ficado de fora na primeira leva:
 * personagem favorito (Jikan, com fallback pro elenco do TMDB),
 * navegar pro episódio anterior/próximo por gesto (swipe), e
 * comentários com resposta aninhada (agora numa tela própria, igual
 * ao web — ver `comments.tsx` nesta mesma pasta).
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

  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null);
  const [animeCharacters, setAnimeCharacters] = useState<FavoriteCharacterOption[]>([]);

  const [watched, setWatched] = useState(false);
  const [watchedLoading, setWatchedLoading] = useState(true);

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [aggregate, setAggregate] = useState<ReviewAggregate>({ average: null, count: 0 });

  const target = useMemo(
    () => ({ mediaType: "series" as const, mediaId: seriesIdNum, seasonNumber, episodeNumber }),
    [seriesIdNum, seasonNumber, episodeNumber]
  );
  const commentCount = useEpisodeCommentCount(target);

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

    fetchMyReview(target).then((value) => {
      if (!cancelled) setMyReview(value);
    });
    fetchReviewAggregate(target).then((value) => {
      if (!cancelled) setAggregate(value);
    });

    fetchSeriesDetails(seriesIdStr).then((value) => {
      if (cancelled) return;
      setSeriesDetails(value);
      const year = value.firstAirDate ? Number(value.firstAirDate.slice(0, 4)) : null;
      // TASK-168 — `value.title` vem em português (a API sempre pede
      // language=pt-BR); o MyAnimeList/Jikan só conhece título em
      // inglês/romaji, então a busca sempre falhava silenciosamente e
      // caía pro elenco do TMDB (foto de dublador em vez de
      // personagem). `matchTitle` é escolhido pra isso especificamente
      // (título alternativo em inglês do TMDB, nunca exibido na tela)
      // — ver `pickTitleForExternalMatching` em apps/web/lib/tmdb/client.ts.
      getAnimeCharacters(value.matchTitle, Number.isFinite(year) ? year : null).then((characters) => {
        if (!cancelled) setAnimeCharacters(characters);
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesIdStr, seasonNumber, episodeNumber]);

  const { previous, next } = useMemo(() => findAdjacentEpisodes(seriesDetails?.seasons, seasonNumber, episodeNumber), [seriesDetails?.seasons, seasonNumber, episodeNumber]);

  const currentSeasonEpisodes = useMemo(() => {
    const currentSeason = seriesDetails?.seasons.find((s) => s.seasonNumber === seasonNumber);
    return currentSeason ? [...currentSeason.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber) : [];
  }, [seriesDetails?.seasons, seasonNumber]);

  /** Anime com correspondência no MyAnimeList: ilustração de verdade do personagem. Sem correspondência: cai pro elenco do TMDB (foto do ator/dublador). */
  const favoriteCharacterOptions: FavoriteCharacterOption[] = useMemo(() => {
    if (animeCharacters.length > 0) return animeCharacters;
    return (seriesDetails?.cast ?? []).map((member) => ({
      id: member.id,
      name: member.character || member.name,
      imageUrl: tmdbImageUrl(member.profilePath, "w185"),
    }));
  }, [animeCharacters, seriesDetails?.cast]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .onEnd((e: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
          if (Math.abs(e.translationX) < SWIPE_THRESHOLD_PX) return;
          if (e.translationX < 0 && next) {
            router.replace(`/episodes/${seriesIdNum}/${next.seasonNumber}/${next.episodeNumber}`);
          } else if (e.translationX > 0 && previous) {
            router.replace(`/episodes/${seriesIdNum}/${previous.seasonNumber}/${previous.episodeNumber}`);
          }
        }),
    [next, previous, seriesIdNum, router]
  );

  async function handleToggleWatched() {
    const previousValue = watched;
    setWatched(!previousValue);
    try {
      await toggleEpisodeWatched(seriesIdNum, seasonNumber, episodeNumber, previousValue);
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao marcar/desmarcar", error);
      setWatched(previousValue);
    }
  }

  function seedMyReview(): Review {
    return {
      id: "",
      userId: "",
      rating: null,
      reviewText: null,
      containsSpoiler: false,
      mood: null,
      watchedPlatform: null,
      favoriteCharacterId: null,
      favoriteCharacterName: null,
      createdAt: new Date().toISOString(),
      author: { username: "", displayName: null, avatarUrl: null },
    };
  }

  async function handleRate(rating: number) {
    setMyReview((current) => (current ? { ...current, rating } : { ...seedMyReview(), rating }));
    try {
      await upsertReview(target, { rating });
      fetchReviewAggregate(target).then(setAggregate);
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar nota", error);
    }
  }

  async function handleSetMood(mood: string | null) {
    setMyReview((current) => (current ? { ...current, mood } : { ...seedMyReview(), mood }));
    try {
      await upsertReview(target, { mood });
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar humor", error);
    }
  }

  async function handleSetPlatform(watchedPlatform: string | null) {
    setMyReview((current) => (current ? { ...current, watchedPlatform } : { ...seedMyReview(), watchedPlatform }));
    try {
      await upsertReview(target, { watchedPlatform });
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar plataforma", error);
    }
  }

  async function handleSetFavoriteCharacter(character: FavoriteCharacterOption | null) {
    setMyReview((current) =>
      current
        ? { ...current, favoriteCharacterId: character?.id ?? null, favoriteCharacterName: character?.name ?? null }
        : { ...seedMyReview(), favoriteCharacterId: character?.id ?? null, favoriteCharacterName: character?.name ?? null }
    );
    try {
      await upsertReview(target, { favoriteCharacterId: character?.id ?? null, favoriteCharacterName: character?.name ?? null });
    } catch (error) {
      console.error("[EpisodeDetailScreen] Falha ao salvar personagem favorito", error);
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
        <MediaDetailSkeleton />
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
        {currentSeasonEpisodes.length > 1 && (
          <View style={styles.dotsRow}>
            <Pressable onPress={() => router.push(`/series/${seriesIdNum}`)} hitSlop={8}>
              <Feather name="chevron-down" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.dots}>
              {currentSeasonEpisodes.map((e) => (
                <View key={e.episodeNumber} style={[styles.dot, e.episodeNumber === episodeNumber && styles.dotActive]} />
              ))}
            </View>
            <View style={{ width: 20 }} />
          </View>
        )}

        <GestureDetector gesture={swipeGesture}>
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
        </GestureDetector>

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

          {watched && favoriteCharacterOptions.length > 0 && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                Quem foi seu personagem favorito?
              </Text>
              <EpisodeFavoriteCharacterPicker
                characters={favoriteCharacterOptions}
                selectedId={myReview?.favoriteCharacterId ?? null}
                onSelect={handleSetFavoriteCharacter}
              />
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

          <Pressable
            style={styles.commentsButton}
            onPress={() => router.push(`/episodes/${seriesIdNum}/${seasonNumber}/${episodeNumber}/comments`)}
          >
            <Feather name="message-circle" size={16} color={colors.text} />
            <Text style={styles.commentsButtonText}>
              {commentCount} COMENTÁRIO{commentCount === 1 ? "" : "S"}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dots: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.primary,
  },
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
  commentsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  commentsButtonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: colors.text,
  },
});
