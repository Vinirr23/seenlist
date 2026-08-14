import { useState, useMemo } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMovieDetails, useMovieStatus } from "@/lib/useMovieDetails";
import { dismissRecommendation } from "@/lib/recommendations";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { MediaDetailSkeleton } from "@/components/media/MediaDetailSkeleton";
import { MovieHeader } from "@/components/movie-detail/MovieHeader";
import { MovieActions } from "@/components/movie-detail/MovieActions";
import { MovieQuickActionsSheet } from "@/components/movie-detail/MovieQuickActionsSheet";
import { RecommendationQuickActionsSheet } from "@/components/social/RecommendationQuickActionsSheet";
import { StreamingProviders } from "@/components/movie-detail/StreamingProviders";
import { CastCarousel } from "@/components/series-detail/CastCarousel";
import { SimilarTitlesCarousel } from "@/components/media/SimilarTitlesCarousel";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { TrailerCard } from "@/components/media/TrailerCard";
import { MetaRow } from "@/components/media/MetaRow";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/** Mesmo mapa do web (`MovieInfo.tsx`) — código de idioma do TMDB pra chave de tradução, não texto fixo. */
const LANGUAGE_KEYS: Record<string, string> = {
  en: "media.lang.en",
  pt: "media.lang.pt",
  es: "media.lang.es",
  fr: "media.lang.fr",
  ja: "media.lang.ja",
  ko: "media.lang.ko",
  de: "media.lang.de",
  it: "media.lang.it",
  zh: "media.lang.zh",
};

/**
 * TASK-097 — porta de `MovieDetailsView.tsx` + `MovieHeader.tsx` +
 * `MovieActions.tsx` + `MovieInfo.tsx` + `StreamingProviders.tsx` do
 * web. Mais simples que série (sem temporadas/episódios): sinopse,
 * ficha técnica, elenco (reaproveita o `CastCarousel` de
 * series-detail, é o mesmo componente pros dois), onde assistir.
 *
 * Fora do escopo, de propósito: filmes parecidos, avaliações,
 * comentários, "reassistir" — mesmos motivos da tela de série.
 */
export default function MovieDetailScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(INTL_LOCALES[locale], { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    [locale]
  );
  const { id, recId } = useLocalSearchParams<{ id: string; recId?: string }>();
  const movieId = String(id);
  const numericId = Number(movieId);
  const [showRecommendationActions, setShowRecommendationActions] = useState(Boolean(recId));
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const { movie, isLoading, isError, refetch } = useMovieDetails(movieId);
  const { status, busy, changeStatus } = useMovieStatus(numericId);

  if (isLoading) {
    return (
      <Screen>
        <MediaDetailSkeleton />
      </Screen>
    );
  }

  if (isError || !movie) {
    return (
      <Screen>
        <PageError message={t("error.loadMovieFailed")} onRetry={() => refetch()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} bottomInset>
      <ScrollView>
        <MovieHeader movie={movie} watched={status === "watched"} onMorePress={() => setShowMoreOptions(true)} />

        <View style={styles.body}>
          <MovieActions movieId={numericId} currentStatus={status} busy={busy} onChange={changeStatus} />

          <Text style={styles.overview}>{movie.overview || t("media.noSynopsisAvailable")}</Text>

          <View style={styles.metaGrid}>
            <MetaRow label={t("media.director")} value={movie.director ?? "—"} />
            <MetaRow label={t("media.studios")} value={movie.studios.join(", ") || "—"} />
            <MetaRow label={t("media.country")} value={movie.country ?? "—"} />
            <MetaRow
              label={t("media.language")}
              value={(movie.language && t(LANGUAGE_KEYS[movie.language] ?? "")) || movie.language || "—"}
            />
            {movie.budget !== null && <MetaRow label={t("media.budget")} value={currencyFormatter.format(movie.budget)} />}
            {movie.revenue !== null && <MetaRow label={t("media.revenue")} value={currencyFormatter.format(movie.revenue)} />}
          </View>

          {!!movie.trailerKey && (
            <View>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("media.trailer")}
              </Text>
              <TrailerCard videoKey={movie.trailerKey} />
            </View>
          )}

          <View>
            <Text variant="subtitle" style={styles.sectionTitle}>
              {t("media.mainCast")}
            </Text>
            <CastCarousel cast={movie.cast} />
          </View>

          {/* A PEDIDO (confirmação de paridade web/mobile) — ordem trocada pra bater com o web: "Onde assistir" vem ANTES de "Filmes parecidos" lá, estava depois aqui. */}
          <StreamingProviders providers={movie.watchProviders} />

          <View>
            <Text variant="subtitle" style={styles.sectionTitle}>
              {t("media.similarMovies")}
            </Text>
            <SimilarTitlesCarousel items={movie.similar} />
          </View>

          <View>
            <Text variant="subtitle" style={styles.sectionTitle}>
              {t("social.reviews")}
            </Text>
            <ReviewsSection
              target={{ mediaType: "movie", mediaId: numericId }}
              media={{ title: movie.title, posterPath: movie.posterPath }}
            />
          </View>
        </View>
      </ScrollView>

      {showRecommendationActions && (
        <RecommendationQuickActionsSheet
          mediaType="movie"
          onWantToWatch={() => {
            changeStatus("want_to_watch");
            setShowRecommendationActions(false);
          }}
          onStartWatching={() => setShowRecommendationActions(false)}
          onIgnore={() => {
            if (recId) dismissRecommendation(recId).catch(() => {});
            setShowRecommendationActions(false);
          }}
        />
      )}

      {showMoreOptions && (
        <MovieQuickActionsSheet
          movieId={numericId}
          movieTitle={movie.title}
          onRemoved={() => router.back()}
          onClose={() => setShowMoreOptions(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: spacing.lg,
    paddingTop: spacing.md,
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
  sectionTitle: {
    marginBottom: spacing.sm,
  },
});
