import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSeriesDetails, useWatchedEpisodes, useSeriesStatus, useIsFavorite, removeSeries } from "@/lib/useSeriesDetails";
import { dismissRecommendation } from "@/lib/recommendations";
import { computeSeriesCaughtUpBadge, type SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { episodeKey } from "@/lib/seriesDetails";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { MediaDetailSkeleton } from "@/components/media/MediaDetailSkeleton";
import { SeriesHeader } from "@/components/series-detail/SeriesHeader";
import { SeriesQuickActionsSheet } from "@/components/series-detail/SeriesQuickActionsSheet";
import { RecommendationQuickActionsSheet } from "@/components/social/RecommendationQuickActionsSheet";
import { ConfettiBurst } from "@/components/series-detail/ConfettiBurst";
import { hapticSuccess } from "@/lib/haptics";
import { maybeRequestReviewAfterSeasonCompleted } from "@/lib/rating";
import { CastCarousel } from "@/components/series-detail/CastCarousel";
import { SimilarTitlesCarousel } from "@/components/media/SimilarTitlesCarousel";
import { BackdropGallery } from "@/components/media/BackdropGallery";
import { TrailerCard } from "@/components/media/TrailerCard";
import { MetaRow } from "@/components/media/MetaRow";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { SeasonAccordion } from "@/components/series-detail/SeasonAccordion";
import { EpisodeCarousel } from "@/components/series-detail/EpisodeCarousel";
import { colors, spacing, radius } from "@/lib/theme";

type DetailTab = "sobre" | "episodios";

/**
 * TASK-098 (correção) — trocado o seletor de 3 botões sempre
 * visíveis (que eu tinha inventado, sem equivalente no web e com a
 * redundância "Assistir depois"/"Pausada" apontada pelo usuário) pelo
 * menu "..." de verdade, idêntico ao `SeriesQuickActionsSheet.tsx`
 * do web. "Assistindo" não é mais escolhido manualmente — vira isso
 * sozinho quando um episódio é marcado (`recalculateSeriesCategory...`,
 * já existia desde a leva anterior). Também entrou o
 * `EpisodeCarousel` (topo da aba Episódios) que tinha ficado de fora.
 */
export default function SeriesDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id, recId } = useLocalSearchParams<{ id: string; recId?: string }>();
  const seriesId = String(id);
  const numericId = Number(seriesId);
  const [tab, setTab] = useState<DetailTab>("episodios");
  const [showActions, setShowActions] = useState(false);
  const [showRecommendationActions, setShowRecommendationActions] = useState(Boolean(recId));

  const { series, isLoading, isError, refetch } = useSeriesDetails(seriesId);
  const { watched, busy: episodesBusy, toggle, markMany, unmarkSeason, rewatch } = useWatchedEpisodes(numericId);
  const { status, changeStatus } = useSeriesStatus(numericId);
  const { isFavorite, toggle: toggleFavorite } = useIsFavorite(numericId);

  const watchedCount = watched.size;

  // TASK-170 — precisa ficar ANTES dos `return` condicionais abaixo
  // (regra dos hooks). Mesma lógica de "linha de base" do web —
  // ver comentário lá (`SeriesDetailsView.tsx`) pro raciocínio
  // completo de por que não dá pra só comparar contra o valor do
  // primeiro render (que é sempre "carregando").
  const caughtUpBadge = series ? computeSeriesCaughtUpBadge(series, watched) : null;
  const [showConfetti, setShowConfetti] = useState(false);
  const badgeBaselineRef = useRef<{ established: boolean; value: SeriesCaughtUpBadge }>({
    established: false,
    value: null,
  });

  useEffect(() => {
    if (!series) return;
    if (!badgeBaselineRef.current.established) {
      badgeBaselineRef.current = { established: true, value: caughtUpBadge };
      return;
    }
    if (caughtUpBadge === "ended" && badgeBaselineRef.current.value !== "ended") {
      // A PEDIDO (feedback háptico) — terminar uma série é o momento
      // mais especial do app (é o único que já ganha confete). Sem
      // háptico, a comemoração era só visual: quem está com o som
      // desligado e não estava olhando na hora não sentia nada.
      hapticSuccess();
      setShowConfetti(true);
    }
    badgeBaselineRef.current.value = caughtUpBadge;
  }, [caughtUpBadge, series]);

  /*
   * A PEDIDO — pedir avaliação na Play Store ao terminar uma
   * TEMPORADA (trocado de "série inteira" — ver `lib/rating.ts` pro
   * raciocínio completo). Mesmo padrão de "linha de base" do efeito
   * acima, só que rastreando cada temporada separadamente (um
   * `Map`, não um valor único) — sem isso, toda temporada já
   * completa desde a primeira renderização ia disparar o pedido à
   * toa assim que a tela abrisse.
   */
  const seasonWatchedBaselineRef = useRef<{ established: boolean; value: Map<number, boolean> }>({
    established: false,
    value: new Map(),
  });

  useEffect(() => {
    if (!series) return;

    const currentSeasonWatched = new Map<number, boolean>();
    for (const season of series.seasons) {
      if (season.seasonNumber === 0 || season.episodes.length === 0) continue; // temporada 0 (especiais) não conta pra esse gatilho
      const allWatched = season.episodes.every((ep) => watched.has(episodeKey(ep.seasonNumber, ep.episodeNumber)));
      currentSeasonWatched.set(season.seasonNumber, allWatched);
    }

    if (!seasonWatchedBaselineRef.current.established) {
      seasonWatchedBaselineRef.current = { established: true, value: currentSeasonWatched };
      return;
    }

    const previous = seasonWatchedBaselineRef.current.value;
    for (const [seasonNumber, isWatchedNow] of currentSeasonWatched) {
      if (isWatchedNow && previous.get(seasonNumber) !== true) {
        maybeRequestReviewAfterSeasonCompleted();
        break; // uma temporada por vez basta — não precisa disparar mais de uma vez no mesmo momento, mesmo que várias transicionem juntas (ex.: marcar várias de uma vez via "marcar temporada inteira")
      }
    }

    seasonWatchedBaselineRef.current.value = currentSeasonWatched;
  }, [series, watched]);

  if (isLoading) {
    return (
      <Screen>
        <MediaDetailSkeleton />
      </Screen>
    );
  }

  if (isError || !series) {
    return (
      <Screen>
        <PageError message={t("error.loadSeriesFailed")} onRetry={() => refetch()} />
      </Screen>
    );
  }

  async function handleRemove() {
    setShowActions(false);
    await removeSeries(numericId);
    router.back();
  }

  return (
    <Screen padded={false} bottomInset>
      <ScrollView>
        <SeriesHeader
          series={series}
          watchedCount={watchedCount}
          totalEpisodes={series.numberOfEpisodes}
          onMorePress={() => setShowActions(true)}
        />

        <View style={styles.body}>
          <View style={styles.tabs}>
            <TabButton label={t("media.aboutTab")} active={tab === "sobre"} onPress={() => setTab("sobre")} />
            <TabButton label={t("seriesHome.episodesTab")} active={tab === "episodios"} onPress={() => setTab("episodios")} />
          </View>

          {tab === "sobre" ? (
            <View style={styles.section}>
              <Text style={styles.overview}>{series.overview || t("media.noSynopsisAvailable")}</Text>

              {series.genres.length > 0 && (
                <View style={styles.genreRow}>
                  {series.genres.map((genre) => (
                    <View key={genre} style={styles.genreChip}>
                      <Text style={styles.genreChipText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.metaGrid}>
                <MetaRow label={t("media.status")} value={series.status} icon={<Feather name="layers" size={14} color={colors.muted} style={styles.metaIcon} />} />
                <MetaRow
                  label={t("media.premiere")}
                  value={series.firstAirDate?.slice(0, 4) ?? "—"}
                  icon={<Feather name="calendar" size={14} color={colors.muted} style={styles.metaIcon} />}
                />
                <MetaRow
                  label={t("media.seasons")}
                  value={String(series.numberOfSeasons)}
                  icon={<Feather name="tv" size={14} color={colors.muted} style={styles.metaIcon} />}
                />
                <MetaRow
                  label={t("seriesHome.episodesTab")}
                  value={String(series.numberOfEpisodes)}
                  icon={<Feather name="film" size={14} color={colors.muted} style={styles.metaIcon} />}
                />
                <MetaRow label={t("media.network")} value={series.networks.join(", ") || "—"} />
              </View>

              {!!series.trailerKey && (
                <View>
                  <Text variant="subtitle" style={styles.sectionTitle}>
                    Trailer
                  </Text>
                  <TrailerCard videoKey={series.trailerKey} />
                </View>
              )}

              <View>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  Elenco principal
                </Text>
                <CastCarousel
                  cast={series.cast}
                  title={series.matchTitle}
                  year={series.firstAirDate ? Number(series.firstAirDate.slice(0, 4)) : null}
                />
              </View>

              {series.gallery.length > 0 && (
                <View>
                  <Text variant="subtitle" style={styles.sectionTitle}>
                    Galeria
                  </Text>
                  <BackdropGallery paths={series.gallery} />
                </View>
              )}

              <View>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  {t("media.similarSeries")}
                </Text>
                <SimilarTitlesCarousel items={series.similar} />
              </View>

              <View>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  {t("social.reviews")}
                </Text>
                <ReviewsSection
                  target={{ mediaType: "series", mediaId: numericId }}
                  media={{ title: series.title, posterPath: series.posterPath }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <EpisodeCarousel seriesId={numericId} category={status} seasons={series.seasons} watched={watched} onToggleEpisode={toggle} caughtUpBadge={caughtUpBadge} />

              {series.seasons.length === 0 ? (
                <Text variant="muted">Nenhuma temporada encontrada.</Text>
              ) : (
                series.seasons.map((season, index) => (
                  <SeasonAccordion
                    key={season.seasonNumber}
                    seriesId={numericId}
                    season={season}
                    watched={watched}
                    busy={episodesBusy}
                    onToggleEpisode={toggle}
                    onMarkMany={markMany}
                    onUnmarkSeason={unmarkSeason}
                    onRewatch={rewatch}
                    defaultOpen={index === 0}
                  />
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {showActions && (
        <SeriesQuickActionsSheet
          seriesId={numericId}
          seriesTitle={series.title}
          currentStatus={status}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          onSetStatus={(newStatus) => {
            changeStatus(newStatus);
            setShowActions(false);
          }}
          onRemove={handleRemove}
          onClose={() => setShowActions(false)}
        />
      )}

      {showRecommendationActions && (
        <RecommendationQuickActionsSheet
          mediaType="series"
          onWantToWatch={() => {
            changeStatus("want_to_watch");
            setShowRecommendationActions(false);
          }}
          onStartWatching={() => {
            changeStatus("watching");
            setShowRecommendationActions(false);
          }}
          onIgnore={() => {
            if (recId) dismissRecommendation(recId).catch(() => {});
            setShowRecommendationActions(false);
          }}
        />
      )}

      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text variant="label" style={active ? styles.tabLabelActive : styles.tabLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tabButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.background,
  },
  section: {
    gap: spacing.lg,
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  genreChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.text,
  },
  metaIcon: {
    marginBottom: 4,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
});
