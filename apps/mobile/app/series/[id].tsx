import { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSeriesDetails, useWatchedEpisodes, useSeriesStatus, useIsFavorite, removeSeries } from "@/lib/useSeriesDetails";
import { Screen, Text } from "@/components/ui";
import { SeriesHeader } from "@/components/series-detail/SeriesHeader";
import { SeriesQuickActionsSheet } from "@/components/series-detail/SeriesQuickActionsSheet";
import { CastCarousel } from "@/components/series-detail/CastCarousel";
import { SimilarTitlesCarousel } from "@/components/media/SimilarTitlesCarousel";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const seriesId = String(id);
  const numericId = Number(seriesId);
  const [tab, setTab] = useState<DetailTab>("episodios");
  const [showActions, setShowActions] = useState(false);

  const { series, isLoading, isError } = useSeriesDetails(seriesId);
  const { watched, busy: episodesBusy, toggle, markMany, unmarkSeason, rewatch } = useWatchedEpisodes(numericId);
  const { status, changeStatus } = useSeriesStatus(numericId);
  const { isFavorite, toggle: toggleFavorite } = useIsFavorite(numericId);

  const watchedCount = watched.size;

  if (isLoading) {
    return (
      <Screen>
        <Text variant="muted">Carregando…</Text>
      </Screen>
    );
  }

  if (isError || !series) {
    return (
      <Screen>
        <Text variant="muted">Não foi possível carregar esta série agora.</Text>
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
            <TabButton label="Sobre" active={tab === "sobre"} onPress={() => setTab("sobre")} />
            <TabButton label="Episódios" active={tab === "episodios"} onPress={() => setTab("episodios")} />
          </View>

          {tab === "sobre" ? (
            <View style={styles.section}>
              <Text style={styles.overview}>{series.overview || "Sem sinopse disponível."}</Text>

              <View style={styles.metaGrid}>
                <MetaRow label="Status" value={series.status} />
                <MetaRow label="Estreia" value={series.firstAirDate ?? "—"} />
                <MetaRow label="Temporadas" value={String(series.numberOfSeasons)} />
                <MetaRow label="Episódios" value={String(series.numberOfEpisodes)} />
                <MetaRow label="Rede" value={series.networks.join(", ") || "—"} />
                <MetaRow label="Gêneros" value={series.genres.join(", ") || "—"} />
              </View>

              <View>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  Elenco principal
                </Text>
                <CastCarousel cast={series.cast} />
              </View>

              <View>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  Séries parecidas
                </Text>
                <SimilarTitlesCarousel items={series.similar} />
              </View>

              <View>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  Avaliações
                </Text>
                <ReviewsSection
                  target={{ mediaType: "series", mediaId: numericId }}
                  media={{ title: series.title, posterPath: series.posterPath }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <EpisodeCarousel seriesId={numericId} category={status} seasons={series.seasons} watched={watched} onToggleEpisode={toggle} />

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
