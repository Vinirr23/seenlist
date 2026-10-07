import { useEffect, useMemo, useRef, useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSeriesDetails, useWatchedEpisodes, useSeriesStatus, useIsFavorite } from "@/lib/useSeriesDetails";
import { dismissRecommendation } from "@/lib/recommendations";
import { computeSeriesCaughtUpBadge, type SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { episodeKey, isEpisodeWatchedSync } from "@/lib/seriesDetails";
import { tmdbImageUrl } from "@/lib/library";
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
import { SeasonRecapCard } from "@/components/series-detail/SeasonRecapCard";
import { findCompletedPreviousSeason } from "@/lib/seasonRecapEligibility";
import { SeriesWatchProviders } from "@/components/series-detail/SeriesWatchProviders";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { getSeriesCategoryColorByStatus } from "@/lib/seriesCategories";
import { hapticTick, hapticWarning } from "@/lib/haptics";
import { colors, spacing, radius, fontSize, fontFamily } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

type DetailTab = "sobre" | "episodios";

/**
 * CORREÇÃO (bug real, reportado — "status está ended ao invés de em
 * português... também aparece: returning series em outra série") —
 * `series.status` vem cru da TMDB (`Ended`/`Returning Series`/
 * `Canceled`/`In Production`/`Planned`/`Pilot`, sempre em inglês) e
 * era jogado direto no `MetaRow`, sem passar por `t()` — ver as novas
 * chaves `media.seriesStatus.*` em `lib/i18n/translations.ts`. Cai de
 * volta pro valor cru se a TMDB devolver algum status fora desses 6
 * (não deveria acontecer, mas não quebra a tela se acontecer).
 */
function seriesStatusLabel(status: string, t: (key: string) => string): string {
  const key = `media.seriesStatus.${status}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

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
  /**
   * A PEDIDO (2026-09-25 — "adiciona 'todos os episódios' e o botão
   * pra selecionar tudo de uma vez") — sheet de confirmação do botão
   * de marcar/desmarcar a SÉRIE INTEIRA, ver `handleMarkAllSeries`/
   * `handleUnmarkAllSeries` mais abaixo. Mesmo padrão do sheet de
   * temporada (`SeasonAccordion.tsx`), só que sem os dois, aqui é só
   * um booleano — não tem variação tipo "marcar temporadas
   * anteriores?", já que aqui já é a série toda de uma vez.
   */
  const [seriesMarkAllOpen, setSeriesMarkAllOpen] = useState(false);

  const { series, isLoading, isError, refetch } = useSeriesDetails(seriesId);
  const {
    watched,
    watchedEpisodeIds,
    rewatchCounts,
    busy: episodesBusy,
    toggle,
    markMany,
    unmarkSeason,
    rewatch,
    rewatchSeasonAction,
  } = useWatchedEpisodes(numericId);
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

  /**
   * TASK (Resumo da Temporada) — seção 3 da auditoria: decide, só com
   * o que já está carregado nesta tela (sem chamada nova), se existe
   * uma temporada anterior recém-concluída pra mostrar o card. Usa
   * `isEpisodeWatchedSync` sem o 4º/5º argumento (episodeId/
   * watchedEpisodeIds) de propósito — a elegibilidade só precisa do
   * Set por chave `temporada:episódio`, não do id fixo da TMDB.
   */
  const completedPreviousSeason = useMemo(() => {
    if (!series) return null;
    return findCompletedPreviousSeason(series.seasons, (seasonNumber, episodeNumber) =>
      isEpisodeWatchedSync(watched, seasonNumber, episodeNumber)
    );
  }, [series, watched]);

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

  /**
   * A PEDIDO (2026-09-25 — botão de "selecionar tudo" ao lado de
   * "Todos os episódios") — mesmo cálculo do `allWatched` de
   * `SeasonAccordion.tsx`, só que pra série inteira: `watchedCount`
   * já é o total de episódios assistidos em TODAS as temporadas (ver
   * comentário em `watchedCount` acima), comparado contra
   * `series.numberOfEpisodes`.
   */
  const seriesAllWatched = series.numberOfEpisodes > 0 && watchedCount === series.numberOfEpisodes;

  /**
   * Marca todos os episódios PENDENTES da série de uma vez (todas as
   * temporadas) — usa a mesma `markMany` que cada `SeasonAccordion`
   * já usa pra marcar uma temporada inteira, só que com a lista cheia
   * de episódios não assistidos de TODAS as temporadas.
   */
  function handleMarkAllSeries() {
    hapticTick();
    const pendentes: { seasonNumber: number; episodeNumber: number; episodeId?: number }[] = [];
    for (const season of series!.seasons) {
      for (const ep of season.episodes) {
        if (!watched.has(episodeKey(season.seasonNumber, ep.episodeNumber))) {
          pendentes.push({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, episodeId: ep.id });
        }
      }
    }
    markMany(pendentes);
    setSeriesMarkAllOpen(false);
  }

  /**
   * Desmarca a série inteira — não existe um `unmarkSeries` no backend
   * (só `unmarkSeasonWatched`, por temporada), então compõe chamando
   * `unmarkSeason` pra cada temporada, igual o botão de cada
   * temporada já faz uma por uma, só que em sequência automática.
   */
  function handleUnmarkAllSeries() {
    // FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
    // 2026-09-26) — desmarcar a série inteira descarta todo o
    // progresso/rewatch (mesmo peso de "remover da biblioteca", que já
    // usa `hapticWarning`) — era `hapticTick`, o mesmo háptico neutro
    // de marcar (ação leve), sem distinguir as duas direções.
    hapticWarning();
    for (const season of series!.seasons) {
      unmarkSeason(season.seasonNumber);
    }
    setSeriesMarkAllOpen(false);
  }

  /**
   * FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
   * 2026-09-26) — a remoção em si (e o "Removendo…") agora acontecem
   * DENTRO do `SeriesQuickActionsSheet` (mesmo padrão de
   * `MovieQuickActionsSheet.tsx`); este handler só roda DEPOIS de
   * remover com sucesso, fechando a folha e voltando.
   */
  function handleRemoved() {
    setShowActions(false);
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

        {/*
          CORREÇÃO DE CAUSA RAIZ (2026-09-25, bug real reportado por
          screenshot — "sobre/episódios deve subir mais, não está
          visualmente coerente") — as abas moraram DENTRO de
          `styles.body` até aqui, e `body` tem `paddingVertical:
          spacing.lg` (24px). Esse padding sempre existiu; só ficou
          visível como "espaço demais" agora que a correção anterior
          tirou o fundo preto (que antes escondia essa folga, por ter
          a MESMA cor de fundo). O respiro de 24px faz sentido ENTRE
          as abas e a primeira seção de conteúdo — não entre a capa e
          as abas, que na referência ficam coladas na barra de
          progresso. Fix: tira as abas de dentro de `body` (que
          continua dando aquele respiro pro conteúdo abaixo delas) e
          põe direto aqui, sem padding vertical nenhum — coladas no
          fim do header, igual a referência.
        */}
        <View style={styles.tabs}>
          <TabButton label={t("media.aboutTab")} active={tab === "sobre"} onPress={() => setTab("sobre")} />
          <TabButton label={t("seriesHome.episodesTab")} active={tab === "episodios"} onPress={() => setTab("episodios")} />
        </View>

        <View style={styles.body}>
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
              {/*
                CORREÇÃO (bug real, reportado — "adiciona as linhas de
                separação igual fizemos em filmes") — esta aba nunca
                tinha ganhado as linhas divisórias entre seções que
                `app/movies/[id].tsx` já usa (`styles.section`/
                `styles.sectionLast` de lá, aqui `sectionItem`/
                `sectionItemLast` pra não colidir com o nome já usado
                pelo wrapper da aba inteira). Mesmo padrão: cada bloco
                ganha uma borda embaixo + respiro, exceto o último
                (Avaliações), que fica sem linha por não ter mais nada
                depois pra separar.
              */}
              {/* IMPLEMENTAÇÃO (2026-09-04) — "onde assistir" nunca existia
                  nesta tela. Mesma posição do web (antes da sinopse, ver
                  SeriesDetailsView.tsx/SeriesWatchProviders.tsx).
                  `SeriesWatchProviders` devolve `null` sozinho quando não
                  há provedor nenhum (ver o componente) — por isso o
                  `length > 0` aqui fora, senão sobraria uma linha
                  divisória separando o nada, mesmo cuidado já tomado em
                  `app/movies/[id].tsx` pro `StreamingProviders`. */}
              {series.watchProviders.length > 0 && (
                <View style={styles.sectionItem}>
                  <SeriesWatchProviders providers={series.watchProviders} />
                </View>
              )}

              {/*
                PORTE DO WEB (2026-09-09) — a sinopse era texto solto.
                No web ela tem TÍTULO ("Sinopse", `text-sm font-semibold`)
                e um "Ler mais/Ler menos": o texto fica limitado a 5
                linhas (`line-clamp-5`) e o botão só aparece quando é
                longo o bastante pra transbordar (o web usa 220
                caracteres como corte). Nada disso existia aqui.
              */}
              <View style={styles.sectionItem}>
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
              </View>

              <View style={styles.sectionItem}>
                <View style={styles.metaGrid}>
                  {/* CORREÇÃO (bug real, reportado — "status está ended ao
                      invés de em português... também aparece: returning
                      series em outra série") — `series.status` vem cru da
                      TMDB, sempre em inglês; ver `seriesStatusLabel` acima
                      e as chaves `media.seriesStatus.*`. */}
                  <MetaRow label={t("media.status")} value={seriesStatusLabel(series.status, t)} icon={<Feather name="layers" size={14} color={colors.muted} style={styles.metaIcon} />} />
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
              </View>

              {!!series.trailerKey && (
                <View style={styles.sectionItem}>
                  <Text style={styles.sectionTitle}>{t("media.trailer")}</Text>
                  <TrailerCard videoKey={series.trailerKey} />
                </View>
              )}

              <View style={styles.sectionItem}>
                {/* Estava escrito à mão em português ("Elenco principal"), sem tradução — o web usa `series.mainCast`. */}
                <Text style={styles.sectionTitle}>{t("media.mainCast")}</Text>
                <CastCarousel
                  cast={series.cast}
                  title={series.matchTitle}
                  year={series.firstAirDate ? Number(series.firstAirDate.slice(0, 4)) : null}
                />
              </View>

              {series.gallery.length > 0 && (
                <View style={styles.sectionItem}>
                  <Text style={styles.sectionTitle}>{t("media.gallery")}</Text>
                  <BackdropGallery paths={series.gallery} />
                </View>
              )}

              <View style={styles.sectionItem}>
                <Text style={styles.sectionTitle}>
                  {t("media.similarSeries")}
                </Text>
                <SimilarTitlesCarousel items={series.similar} />
              </View>

              <View style={styles.sectionItemLast}>
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
                /**
                 * A PEDIDO (2026-09-24, redesenho do card "Em dia"/
                 * "Série encerrada" — mockup aprovado, "Proposta A", o
                 * backdrop da própria série escurecido atrás do texto)
                 * — mesmo fallback backdrop→pôster já usado em
                 * `app/week-review.tsx` (`details.backdropPath` pode
                 * ser `null` pra séries sem imagem de fundo no TMDB).
                 */
                backdropUrl={tmdbImageUrl(series.backdropPath, "w780") ?? tmdbImageUrl(series.posterPath, "w780")}
              />

              {/*
                TASK (Resumo da Temporada) — card contextual (seção 4
                da auditoria): entre o carrossel "Continuar
                acompanhando" (acima) e "Todos os episódios" (abaixo).
                Só monta quando existe uma temporada anterior 100%
                concluída (`completedPreviousSeason`, seção 3) — o
                próprio `SeasonRecapCard` busca o recap e se esconde
                sozinho se não houver dados suficientes ou der erro
                (seção 9).
              */}
              {completedPreviousSeason && (
                <SeasonRecapCard
                  seriesId={numericId}
                  seasonNumber={completedPreviousSeason.seasonNumber}
                  seriesTitle={series.title}
                  backdropUrl={tmdbImageUrl(series.backdropPath, "w780") ?? tmdbImageUrl(series.posterPath, "w780")}
                />
              )}

              {/*
                A PEDIDO (2026-09-25, print de referência — "analise
                que tem um espaço e uma linha que separa os cards
                horizontais de 'todos os episódios'. adiciona 'todos
                os episódios' e o botão pra selecionar tudo de uma
                vez") — na referência, depois do carrossel horizontal
                tem uma linha fina + respiro, e só DEPOIS o título
                "Todos os episódios" com um círculo de check (marca/
                desmarca a série inteira, mesmo padrão visual do
                círculo de cada `SeasonAccordion`). Nada disso existia
                aqui — ia direto do carrossel pro acordeão de
                temporadas.
              */}
              {series.seasons.length > 0 && (
                <View style={styles.allEpisodesHeader}>
                  <Text style={[styles.sectionTitle, styles.allEpisodesTitle]}>{t("series.allEpisodesTitle")}</Text>
                  <Pressable
                    hitSlop={8}
                    disabled={episodesBusy}
                    onPress={() => setSeriesMarkAllOpen(true)}
                    style={[styles.seriesCheckCircle, seriesAllWatched ? { backgroundColor: categoryColor ?? colors.primary } : styles.seriesCheckCirclePending]}
                  >
                    {seriesAllWatched && <Feather name="check" size={16} color="#000000" />}
                  </Pressable>
                </View>
              )}

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
                    rewatchCounts={rewatchCounts}
                    busy={episodesBusy}
                    onToggleEpisode={toggle}
                    onMarkMany={markMany}
                    onUnmarkSeason={unmarkSeason}
                    onRewatch={rewatch}
                    onRewatchSeason={rewatchSeasonAction}
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
          onRemoved={handleRemoved}
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
            // CORREÇÃO (Fase 3, achado alto — "Ignorar" engolia erro em
            // silêncio, sem log nem feedback) — continua sem confirmação
            // (ação leve, por decisão do usuário); o sheet já fecha ao
            // tocar, então não há risco prático de toque duplo aqui.
            if (recId) {
              dismissRecommendation(recId).catch((error) => {
                console.error("[SeriesDetailScreen] Falha ao ignorar recomendação", error);
                Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
              });
            }
            setShowRecommendationActions(false);
          }}
        />
      )}

      {/*
        A PEDIDO (2026-09-25 — botão de "selecionar tudo" ao lado de
        "Todos os episódios") — mesmo `OptionSheet` usado por
        temporada, "Marcar" pede confirmação (`markSeriesTitle`/
        `Message`, ação única "Confirmar"); "Desmarcar" também passa
        por aqui, com a ação `danger`, igual o sheet de temporada faz
        com `unmarkSeasonAction`.
      */}
      {seriesMarkAllOpen && (
        <OptionSheet
          title={seriesAllWatched ? t("episode.unmarkSeriesTitle") : t("episode.markSeriesTitle")}
          message={seriesAllWatched ? t("episode.unmarkSeriesMessage") : t("episode.markSeriesMessage")}
          actions={
            seriesAllWatched
              ? [{ label: t("episode.unmarkSeasonAction"), danger: true, onPress: handleUnmarkAllSeries }]
              : [{ label: t("common.confirm"), active: true, onPress: handleMarkAllSeries }]
          }
          onDismiss={() => setSeriesMarkAllOpen(false)}
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
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-25, bug real reportado por
   * screenshot — "não é pra mudar a cor usada no seenlist, você
   * mudou pra preto" + "ficou um espaço que não é pra existir") —
   * o `.tabs { background: #000000 }` do mockup era o fundo do
   * MOCKUP INTEIRO (`.phone { background: #000 }`, a moldura de
   * telefone da comparação lado a lado), não uma cor pensada pra
   * esse componente dentro do app de verdade. Aplicar um preto
   * CHAPADO aqui destoava do `colors.background` (#0B0E14, azul bem
   * escuro, não preto puro) que o resto da tela usa — e, pior,
   * revelava o `paddingVertical` do `body` (24px) como um vão
   * visível entre a barra de progresso e as abas, porque antes esse
   * respiro tinha a MESMA cor do fundo por trás (por ser
   * transparente) e ficava invisível. Fix: tira o fundo preto,
   * volta a ser transparente (herda o fundo da tela, igual sempre
   * foi) — o vão some porque deixa de ter contraste de cor pra
   * denunciar o padding, e a cor volta a ser a mesma do resto do
   * app. Mantém a borda de baixo (`colors.border`) que já existia
   * pra separar visualmente as abas do conteúdo, já que ela não fazia
   * parte da correção pedida.
   */
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  /**
   * `.tab { flex: 1; text-align: center; padding: 14px 0 12px; font-size:
   * 13px; font-weight: 700; letter-spacing: 0.06em; text-transform:
   * uppercase; color: var(--muted) }` — cada aba ocupa a coluna INTEIRA
   * (`flex: 1`), não só a largura do texto: é o que faz o traço da aba
   * ativa cobrir a coluna toda, não só sublinhar a palavra.
   */
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
  },
  /**
   * `.tab.active { color: var(--text); box-shadow: inset 0 -3px 0
   * var(--text) }` — traço de 3px por DENTRO (evita empurrar o
   * conteúdo 1px como a borda antiga fazia), na cor do texto (branco),
   * não na cor primária.
   */
  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.text,
  },
  /** `font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted)`. */
  tabLabel: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
  },
  tabLabelActive: {
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.text,
  },
  section: {
    gap: spacing.lg,
  },
  /*
   * CORREÇÃO (bug real, reportado — "adiciona as linhas de separação
   * igual fizemos em filmes") — mesmo par de estilos de
   * `app/movies/[id].tsx` (lá chamados `section`/`sectionLast`; aqui
   * com o sufixo "Item" porque `section` já é o nome do wrapper da
   * aba inteira, ver acima). `sectionItemLast` fica vazio de propósito
   * — é a última seção (Avaliações), sem nada depois pra separar.
   */
  sectionItem: {
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionItemLast: {},
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
  /**
   * A PEDIDO (2026-09-25 — linha + respiro entre o carrossel
   * horizontal e "Todos os episódios", igual a referência) — a linha
   * (`borderTopWidth`/`colors.border`, mesmo tom já usado noutras
   * separações da tela) fica ACIMA deste cabeçalho, não abaixo: como
   * `episodesSection` já dá 16px de `gap` entre os irmãos, o
   * `paddingTop` aqui soma mais um respiro só nesta borda, pra não
   * ficar colada demais no carrossel.
   */
  allEpisodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  /** Reaproveita `sectionTitle` (mesmo peso/tamanho dos outros títulos de seção), só tira o `marginBottom` — aqui quem espaça é o `gap` da linha. */
  allEpisodesTitle: {
    marginBottom: 0,
  },
  /** Mesma receita do círculo de cada `SeasonAccordion` (`checkCircle`/`checkCirclePending`), só que pra série inteira. */
  seriesCheckCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  seriesCheckCirclePending: {
    borderWidth: 2,
    borderColor: colors.muted,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.sm` (era literal 14, mesmo valor).
  overview: {
    fontSize: fontSize.sm,
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
    /*
     * CORREÇÃO (2026-09-26, junto com as linhas divisórias) — sinopse
     * e chips de gênero viraram irmãos dentro do mesmo `sectionItem`
     * (ver comentário lá); antes o espaçamento vinha de graça do
     * `gap: spacing.lg` do painel da aba, que separava os dois como
     * itens distintos da lista. Sem ele, precisa deste respiro aqui.
     */
    marginTop: spacing.lg,
  },
  /** `rounded-full px-3 py-1` do web = 12/4; era `spacing.sm` = 8 na horizontal. Borda e fundo vêm do `Glass`. */
  genreChip: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  genreChipText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
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
