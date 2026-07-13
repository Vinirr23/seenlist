import { ScrollView, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMovieDetails, useMovieStatus } from "@/lib/useMovieDetails";
import { Screen, Text } from "@/components/ui";
import { MovieHeader } from "@/components/movie-detail/MovieHeader";
import { MovieActions } from "@/components/movie-detail/MovieActions";
import { StreamingProviders } from "@/components/movie-detail/StreamingProviders";
import { CastCarousel } from "@/components/series-detail/CastCarousel";
import { SimilarTitlesCarousel } from "@/components/media/SimilarTitlesCarousel";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { colors, spacing } from "@/lib/theme";

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const movieId = String(id);
  const numericId = Number(movieId);

  const { movie, isLoading, isError } = useMovieDetails(movieId);
  const { status, busy, changeStatus } = useMovieStatus(numericId);

  if (isLoading) {
    return (
      <Screen>
        <Text variant="muted">Carregando…</Text>
      </Screen>
    );
  }

  if (isError || !movie) {
    return (
      <Screen>
        <Text variant="muted">Não foi possível carregar este filme agora.</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false} bottomInset>
      <ScrollView>
        <MovieHeader movie={movie} watched={status === "watched"} />

        <View style={styles.body}>
          <MovieActions currentStatus={status} busy={busy} onChange={changeStatus} />

          <Text style={styles.overview}>{movie.overview || "Sem sinopse disponível."}</Text>

          <View style={styles.metaGrid}>
            <MetaRow label="Diretor" value={movie.director ?? "—"} />
            <MetaRow label="Estúdios" value={movie.studios.join(", ") || "—"} />
            <MetaRow label="País" value={movie.country ?? "—"} />
            <MetaRow label="Idioma" value={movie.language ?? "—"} />
          </View>

          <View>
            <Text variant="subtitle" style={styles.sectionTitle}>
              Elenco principal
            </Text>
            <CastCarousel cast={movie.cast} />
          </View>

          <View>
            <Text variant="subtitle" style={styles.sectionTitle}>
              Filmes parecidos
            </Text>
            <SimilarTitlesCarousel items={movie.similar} />
          </View>

          <StreamingProviders providers={movie.watchProviders} />

          <View>
            <Text variant="subtitle" style={styles.sectionTitle}>
              Avaliações
            </Text>
            <ReviewsSection
              target={{ mediaType: "movie", mediaId: numericId }}
              media={{ title: movie.title, posterPath: movie.posterPath }}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="muted" style={styles.metaLabel}>
        {label}
      </Text>
      <Text numberOfLines={2} style={styles.metaValue}>
        {value}
      </Text>
    </View>
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
  metaRow: {
    width: "47%",
    gap: 2,
  },
  metaLabel: {
    fontSize: 11,
  },
  metaValue: {
    fontSize: 13,
    color: colors.text,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
});
