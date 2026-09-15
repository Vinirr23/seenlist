import { useState, useMemo } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMovieDetails, useMovieStatus } from "@/lib/useMovieDetails";
import { dismissRecommendation } from "@/lib/recommendations";
import { MOVIE_DETAILS_GLOW_BLOBS } from "@/lib/glowBlobs";
import { Screen, Text, GlassTargetProvider, AmbientGlow } from "@/components/ui";
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
import { useTabBarClearance } from "@/lib/useTabBarClearance";

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
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
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
    <Screen padded={false}>
      {/* `bottomInset` saiu: a barra de navegação agora flutua sobre esta tela (ver `app/_layout.tsx`) e a folga do fim do conteúdo já soma a área segura, via `useTabBarClearance()`. Manter os dois empurrava o conteúdo pra cima duas vezes e ainda tirava o fundo de trás da barra, que é o que dá o efeito de vidro. */}
      {/*
        PORTE DO WEB (2026-09-09) — esta tela não tinha campo de manchas
        nenhum, e o `MovieDetailsView.tsx` do web tem (ver `MOVIE_DETAILS_GLOW_BLOBS`).
        As manchas dele começam mais embaixo que as das telas de lista,
        porque o topo aqui é ocupado pelo herói/capa.
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={MOVIE_DETAILS_GLOW_BLOBS} />}>
      <ScrollView contentContainerStyle={{ paddingBottom: espacoDoDock }}>
        <MovieHeader movie={movie} watched={status === "watched"} onMorePress={() => setShowMoreOptions(true)} />

        <View style={styles.body}>
          <MovieActions movieId={numericId} currentStatus={status} busy={busy} onChange={changeStatus} />

          {/* CORREÇÃO (2026-09-04, achado ao portar "onde assistir" pra
              Série — regra de padronização) — o web tem um comentário
              explícito ("onde assistir antes da sinopse, não depois do
              elenco como estava", MovieDetailsView.tsx) confirmando que
              essa posição (depois do elenco) ficou desatualizada lá em
              2026-08-25 e nunca foi replicada aqui no mobile. Movido pra
              bater com o web de verdade: logo após as ações, antes da
              sinopse. */}
          <StreamingProviders providers={movie.watchProviders} />

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
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** O provedor ocupa a tela toda pras manchas cobrirem tudo — mesmo estilo das outras telas com vidro. */
  glassFill: {
    flex: 1,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `padding` (esquerda/direita) era `spacing.lg`
  // (24); web usa `px-4` (`spacing.md`=16) como borda de tela.
  // `paddingBottom` (herdado do `padding` antigo) e `gap` (ritmo
  // vertical entre seções) NÃO foram tocados — fora do escopo.
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
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
