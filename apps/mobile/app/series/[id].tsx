import { useEffect, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSeriesDetails, useWatchedEpisodes, useSeriesStatus, useIsFavorite, removeSeries } from "@/lib/useSeriesDetails";
import { dismissRecommendation } from "@/lib/recommendations";
import { computeSeriesCaughtUpBadge, type SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { episodeKey, isEpisodeWatchedSync } from "@/lib/seriesDetails";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { SERIES_DETAILS_GLOW_BLOBS } from "@/lib/glowBlobs";
import { Screen, Text, GlassTargetProvider, AmbientGlow, Glass } from "@/components/ui";
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
import { SeriesWatchProviders } from "@/components/series-detail/SeriesWatchProviders";
import { getSeriesCategoryColorByStatus } from "@/lib/seriesCategories";
import { colors, spacing, radius, fontSize, fontFamily } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

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
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const { id, recId } = useLocalSearchParams<{ id: string; recId?: string }>();
  const seriesId = String(id);
  const numericId = Number(seriesId);
  const [tab, setTab] = useState<DetailTab>("episodios");
  /*
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, bug real reportado — "trava
   * quando passo de Sobre pra Episódios") — ver o comentário grande
   * onde essas duas flags são usadas, mais abaixo (perto de
   * `styles.hidden`). Cada uma vira `true` na primeira vez que a
   * respectiva aba é mostrada, e nunca mais volta a `false` — é o que
   * permite as duas árvores ficarem montadas ao mesmo tempo depois da
   * primeira visita, em vez de desmontar/remontar a cada troca.
   */
  const [jaMontouSobre, setJaMontouSobre] = useState(false);
  const [jaMontouEpisodios, setJaMontouEpisodios] = useState(true);
  useEffect(() => {
    if (tab === "sobre") setJaMontouSobre(true);
    else setJaMontouEpisodios(true);
  }, [tab]);
  const [sinopseAberta, setSinopseAberta] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showRecommendationActions, setShowRecommendationActions] = useState(Boolean(recId));

  const { series, isLoading, isError, refetch } = useSeriesDetails(seriesId);
  const { watched, watchedEpisodeIds, busy: episodesBusy, toggle, markMany, unmarkSeason, rewatch } = useWatchedEpisodes(numericId);
  const { status, changeStatus } = useSeriesStatus(numericId);
  const { isFavorite, toggle: toggleFavorite } = useIsFavorite(numericId);

  const watchedCount = watched.size;
  /**
   * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15 — "no web, ao colocar
   * uma série em 'assistir depois' fica da cor certa do status, no
   * mobile não está") — calculado uma vez aqui e repassado pra baixo
   * (`SeriesHeader`, `EpisodeCarousel`, `SeasonAccordion`), mesmo
   * padrão do `categoryColorClass` de `SeriesDetailsView.tsx` do web.
   */
  const categoryColor = getSeriesCategoryColorByStatus(status);

  // TASK-170 — precisa ficar ANTES dos `return` condicionais abaixo
  // (regra dos hooks). Mesma lógica de "linha de base" do web —
  // ver comentário lá (`SeriesDetailsView.tsx`) pro raciocínio
  // completo de por que não dá pra só comparar contra o valor do
  // primeiro render (que é sempre "carregando").
  const caughtUpBadge = series ? computeSeriesCaughtUpBadge(series, watched, watchedEpisodeIds) : null;
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
      // CORREÇÃO (2026-08-26 — "motor resistente") — ID FIXO da TMDB primeiro, ver isEpisodeWatchedSync (seriesDetails.ts).
      const allWatched = season.episodes.every((ep) =>
        isEpisodeWatchedSync(watched, ep.seasonNumber, ep.episodeNumber, ep.id, watchedEpisodeIds)
      );
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
  }, [series, watched, watchedEpisodeIds]);

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
    <Screen padded={false}>
      {/* `bottomInset` saiu: a barra de navegação agora flutua sobre esta tela (ver `app/_layout.tsx`) e a folga do fim do conteúdo já soma a área segura, via `useTabBarClearance()`. Manter os dois empurrava o conteúdo pra cima duas vezes e ainda tirava o fundo de trás da barra, que é o que dá o efeito de vidro. */}
      {/*
        PORTE DO WEB (2026-09-09) — esta tela não tinha campo de manchas
        nenhum, e o `SeriesDetailsView.tsx` do web tem (ver `SERIES_DETAILS_GLOW_BLOBS`).
        As manchas dele começam mais embaixo que as das telas de lista,
        porque o topo aqui é ocupado pelo herói/capa.
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SERIES_DETAILS_GLOW_BLOBS} />}>
      <ScrollView contentContainerStyle={{ paddingBottom: espacoDoDock }}>
        <SeriesHeader
          series={series}
          watchedCount={watchedCount}
          totalEpisodes={series.numberOfEpisodes}
          onMorePress={() => setShowActions(true)}
          categoryColor={categoryColor}
        />

        <View style={styles.body}>
          <View style={styles.tabs}>
            <TabButton label={t("media.aboutTab")} active={tab === "sobre"} onPress={() => setTab("sobre")} />
            <TabButton label={t("seriesHome.episodesTab")} active={tab === "episodios"} onPress={() => setTab("episodios")} />
          </View>

          {/*
            CORREÇÃO DE CAUSA RAIZ (2026-09-17, bug real reportado —
            "trava quando passo de Sobre pra Episódios") — antes, era
            um ternário: cada troca de aba DESMONTAVA a árvore inteira
            de uma e MONTAVA a outra do zero — inclusive a pesada
            (`SeasonAccordion` de todas as temporadas, cada uma com
            vários episódios, mais os carrosséis inteiros da aba Sobre:
            elenco, similares, avaliações, galeria). Montar tudo isso
            de novo a cada toque, na mesma hora em que o indicador da
            aba anima, é o que travava.

            Fix: as duas árvores ficam montadas ao mesmo tempo depois
            da primeira vez que cada uma aparece (`display: "none"` só
            ESCONDE, não desmonta — diferente de tirar do JSX) —
            trocar de aba passa a ser só uma troca de visibilidade,
            sem remontar nada. Custo: a aba que a pessoa nunca abriu
            simplesmente nunca monta (preserva a economia de não gastar
            memória à toa); a que ela já abriu uma vez fica pronta pra
            sempre, sem pagar o custo de montagem de novo a cada troca.
          */}
          {jaMontouSobre && (
            <View style={tab === "sobre" ? styles.section : styles.hidden}>
              {/* IMPLEMENTAÇÃO (2026-09-04) — "onde assistir" nunca existia
                  nesta tela. Mesma posição do web (antes da sinopse, ver
                  SeriesDetailsView.tsx/SeriesWatchProviders.tsx). */}
              <SeriesWatchProviders providers={series.watchProviders} />

              {/*
                PORTE DO WEB (2026-09-09) — a sinopse era texto solto.
                No web ela tem TÍTULO ("Sinopse", `text-sm font-semibold`)
                e um "Ler mais/Ler menos": o texto fica limitado a 5
                linhas (`line-clamp-5`) e o botão só aparece quando é
                longo o bastante pra transbordar (o web usa 220
                caracteres como corte). Nada disso existia aqui.
              */}
              <View>
                <Text style={styles.overviewTitle}>{t("series.overviewTitle")}</Text>
                <Text numberOfLines={sinopseAberta ? undefined : 5} style={styles.overview}>
                  {series.overview || t("media.noSynopsisAvailable")}
                </Text>
                {(series.overview ?? "").length > 220 && (
                  <Pressable onPress={() => setSinopseAberta((v) => !v)}>
                    <Text style={styles.readMore}>
                      {sinopseAberta ? t("series.readLess") : t("series.readMore")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {series.genres.length > 0 && (
                <View style={styles.genreRow}>
                  {series.genres.map((genre) => (
                    /* No web o chip é vidro (`light`), não `colors.surface` com borda escura. */
                    <Glass key={genre} style={styles.genreChip} variant="light">
                      <Text style={styles.genreChipText}>{genre}</Text>
                    </Glass>
                  ))}
                </View>
              )}

              <View style={styles.metaGrid}>
                <MetaRow label={t("media.status")} value={series.status} icon={<Feather name="layers" size={14} color={colors.muted} style={styles.metaIcon} />} />
                {/* O web usa a chave `series.releaseDate` ("Lançamento"); aqui era `media.premiere` ("Estreia"). */}
                <MetaRow
                  label={t("series.releaseDate")}
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
                {/*
                  A "Rede" SAIU (2026-09-09, comparado no print): a
                  grade do web (`SeriesDetailsView.tsx`) tem exatamente
                  QUATRO itens — Status, Lançamento, Temporadas e
                  Episódios. O quinto era invenção do mobile, e como o
                  valor é uma lista longa de emissoras ele quebrava em
                  três linhas e desalinhava a grade de duas colunas.
                */}
              </View>

              {!!series.trailerKey && (
                <View>
                  <Text style={styles.sectionTitle}>{t("media.trailer")}</Text>
                  <TrailerCard videoKey={series.trailerKey} />
                </View>
              )}

              <View>
                {/* Estava escrito à mão em português ("Elenco principal"), sem tradução — o web usa `series.mainCast`. */}
                <Text style={styles.sectionTitle}>{t("media.mainCast")}</Text>
                <CastCarousel
                  cast={series.cast}
                  title={series.matchTitle}
                  year={series.firstAirDate ? Number(series.firstAirDate.slice(0, 4)) : null}
                />
              </View>

              {series.gallery.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>{t("media.gallery")}</Text>
                  <BackdropGallery paths={series.gallery} />
                </View>
              )}

              <View>
                <Text style={styles.sectionTitle}>
                  {t("media.similarSeries")}
                </Text>
                <SimilarTitlesCarousel items={series.similar} />
              </View>

              <View>
                <Text style={styles.sectionTitle}>
                  {t("social.reviews")}
                </Text>
                <ReviewsSection
                  target={{ mediaType: "series", mediaId: numericId }}
                  media={{ title: series.title, posterPath: series.posterPath }}
                />
              </View>
            </View>
          )}
          {jaMontouEpisodios && (
            /* O web usa `space-y-4` (16) aqui, não os 24 da aba Sobre (`space-y-6`). */
            <View style={tab === "episodios" ? styles.episodesSection : styles.hidden}>
              <EpisodeCarousel
                seriesId={numericId}
                category={status}
                seasons={series.seasons}
                watched={watched}
                watchedEpisodeIds={watchedEpisodeIds}
                onToggleEpisode={toggle}
                caughtUpBadge={caughtUpBadge}
                categoryColor={categoryColor}
              />

              {series.seasons.length === 0 ? (
                <Text variant="muted">{t("media.noSeasonsFound")}</Text>
              ) : (
                /* `space-y-3` = 12 entre as temporadas no web. */
                <View style={styles.seasonList}>
                {series.seasons.map((season, index) => (
                  <SeasonAccordion
                    key={season.seasonNumber}
                    seriesId={numericId}
                    season={season}
                    allSeasons={series.seasons}
                    watched={watched}
                    watchedEpisodeIds={watchedEpisodeIds}
                    busy={episodesBusy}
                    onToggleEpisode={toggle}
                    onMarkMany={markMany}
                    onUnmarkSeason={unmarkSeason}
                    onRewatch={rewatch}
                    defaultOpen={index === 0}
                    categoryColor={categoryColor}
                  />
                ))}
                </View>
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
          /*
            CORREÇÃO DE CAUSA RAIZ (2026-09-10, reproduzido pelo usuário —
            "entrei em detalhes da série, abri o sheet e selecionei
            'assistir depois'", mas a Home não atualizou sozinha) —
            `changeStatus(newStatus)` não era esperado (`await`): a
            gravação no Supabase roda em segundo plano enquanto a folha
            já fecha na mesma hora. Como a Home busca a biblioteca de
            novo ASSIM QUE a tela volta a ficar em foco
            (`useLibraryItems`, `useFocusEffect`), e o toque no "voltar"
            costuma vir muito rápido depois de escolher a opção, a busca
            da Home podia vencer a corrida contra a própria gravação —
            lia o status ANTIGO do banco porque a escrita ainda não
            tinha terminado. Agora `onSetStatus` espera a gravação
            terminar antes de fechar a folha — como é um `Modal`, ele
            trava o toque na tela de trás enquanto isso (inclusive o
            botão "voltar" do cabeçalho), então não dá mais pra sair da
            tela antes da escrita confirmar.
          */
          onSetStatus={async (newStatus) => {
            await changeStatus(newStatus);
            setShowActions(false);
          }}
          onRemove={handleRemove}
          onClose={() => setShowActions(false)}
        />
      )}

      {/* Mesma correção de corrida do "..." acima — espera a gravação terminar antes de fechar a folha. */}
      {showRecommendationActions && (
        <RecommendationQuickActionsSheet
          mediaType="series"
          onWantToWatch={async () => {
            await changeStatus("want_to_watch");
            setShowRecommendationActions(false);
          }}
          onStartWatching={async () => {
            await changeStatus("watching");
            setShowRecommendationActions(false);
          }}
          onIgnore={() => {
            if (recId) dismissRecommendation(recId).catch(() => {});
            setShowRecommendationActions(false);
          }}
        />
      )}

      {showConfetti && <ConfettiBurst onDone={() => setShowConfetti(false)} />}
      </GlassTargetProvider>
    </Screen>
  );
}

/**
 * PORTE DO WEB (2026-09-09) — as abas Sobre/Episódios eram PÍLULAS
 * (cápsula arredondada, âmbar chapado quando ativa). No
 * `SeriesTabs.tsx` do web elas são uma barra SUBLINHADA:
 *
 *     trilha:  flex gap-1 border-b border-border px-4
 *     aba:     border-b-2 px-3 py-2.5 text-sm font-medium
 *     ativa:   border-primary text-text
 *     inativa: border-transparent text-muted
 *
 * Ou seja: sem fundo nenhum, o que marca a aba ativa é um traço de 2px
 * embaixo dela, na cor primária, sobre uma linha de 1px que atravessa
 * a largura toda. É um desenho diferente, não uma variação de cor.
 */
function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={active ? styles.tabLabelActive : styles.tabLabel}>{label}</Text>
    </Pressable>
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
  // `paddingVertical` (herdado do `padding` antigo) e `gap` (ritmo
  // vertical entre seções) NÃO foram tocados — fora do escopo.
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  /** `flex gap-1 border-b border-border` — o `px-4` já vem do `body`. */
  tabs: {
    flexDirection: "row",
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  /** `border-b-2 px-3 py-2.5` = traço de 2px, 12 de lado, 10 de altura. */
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    /* Puxa o traço 1px pra baixo pra ele cobrir a linha da trilha, como no CSS. */
    marginBottom: -1,
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  /** `text-sm font-medium` nas duas; só a COR muda. */
  tabLabel: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    fontFamily: fontFamily[500],
    color: colors.muted,
  },
  tabLabelActive: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    fontFamily: fontFamily[500],
    color: colors.text,
  },
  section: {
    gap: spacing.lg,
  },
  episodesSection: {
    gap: spacing.md,
  },
  /** Ver o comentário grande em `jaMontouSobre`/`jaMontouEpisodios` — esconde sem desmontar, pra trocar de aba não remontar a árvore inteira. */
  hidden: {
    display: "none",
  },
  seasonList: {
    gap: 12,
  },
  /** `mb-2 text-sm font-semibold` do web — este é o único título de seção `semibold` da tela; os outros são `medium`. */
  overviewTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    fontFamily: fontFamily[600],
    color: colors.text,
    marginBottom: 8,
  },
  /** `text-sm leading-relaxed` = 14 com entrelinha 1.625 ≈ 23 (era 20). */
  overview: {
    fontSize: 14,
    lineHeight: 23,
    color: colors.text,
  },
  /** `mt-1 text-xs font-semibold text-primary`. */
  readMore: {
    marginTop: 4,
    fontSize: fontSize.xs,
    fontWeight: "600",
    fontFamily: fontFamily[600],
    color: colors.primary,
  },
  /** `grid grid-cols-2 gap-2` do web = duas colunas com 8 de espaço; aqui o espaço era `spacing.md` = 16 (o dobro). A largura de cada card mora no próprio `MetaRow`. */
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  /** `gap-2` = 8 no web; era `spacing.xs` = 4. */
  genreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  /** `rounded-full px-3 py-1` do web = 12/4; era `spacing.sm` = 8 na horizontal. Borda e fundo vêm do `Glass`. */
  genreChip: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
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
  /**
   * `mb-2 text-sm font-medium text-text` do web. Aqui era
   * `variant="subtitle"`, que é 18px/600 — quatro pontos maior e um
   * peso acima do que o web usa nos títulos de "Trailer", "Elenco",
   * "Galeria", "Séries similares" e "Avaliações".
   */
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    fontFamily: fontFamily[500],
    color: colors.text,
    marginBottom: 8,
  },
});
