import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Pressable, Share, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { BlurTargetView } from "expo-blur";
import { Gesture, GestureDetector, type GestureStateChangeEvent, type PanGestureHandlerEventPayload } from "react-native-gesture-handler";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { EPISODE_DETAILS_GLOW_BLOBS } from "@/lib/glowBlobs";
import { Screen, Text, GlassTargetProvider, AmbientGlow, Glass, GelSurface, PressableScale } from "@/components/ui";
import { fetchEpisodePage, type EpisodePageData } from "@/lib/episodeDetails";
import { fetchEpisodeSeriesContext, isEpisodeWatched, toggleEpisodeWatched, type EpisodeSeriesContext, type EpisodeContextSeason } from "@/lib/seriesDetails";
import { useSeriesStatus } from "@/lib/useSeriesDetails";
import { getSeriesCategoryColorByStatus } from "@/lib/seriesCategories";
import { fetchMyReview, fetchReviewAggregate, upsertReview, type Review, type ReviewAggregate } from "@/lib/social/reviews";
import { useEpisodeCommentCount } from "@/lib/social/useEpisodeComments";
import { getAnimeCharacters } from "@/lib/animeCharacters";
import { tmdbImageUrl } from "@/lib/library";
import { PageError } from "@/components/media/PageError";
import { MediaDetailSkeleton } from "@/components/media/MediaDetailSkeleton";
import { EpisodeWatchedButton } from "@/components/series-detail/EpisodeWatchedButton";
import { SeriesWatchProviders } from "@/components/series-detail/SeriesWatchProviders";
import { EpisodeStarRatingRow } from "@/components/episode/EpisodeStarRatingRow";
import { StarRating } from "@/components/reviews/StarRating";
import { EpisodeMoodPicker } from "@/components/episode/EpisodeMoodPicker";
import { EpisodeWatchedPlatformPicker } from "@/components/episode/EpisodeWatchedPlatformPicker";
import { EpisodeFavoriteCharacterPicker, type FavoriteCharacterOption } from "@/components/episode/EpisodeFavoriteCharacterPicker";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { hapticTick } from "@/lib/haptics";
import { colors, radius, spacing, fontSize, scrim, fontFamily } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

/** Idêntico a findAdjacentEpisodes do web — mesma lista de temporadas já em cache, sem chamada nova ao TMDB. */
function findAdjacentEpisodes(
  seasons: EpisodeContextSeason[] | undefined,
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
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  /** Alvo de desfoque LOCAL da capa — ver o comentário no JSX do banner. */
  const alvoDaCapa = useRef<View>(null);
  const { t, locale } = useTranslation();
  const { seriesId, season, episode } = useLocalSearchParams<{ seriesId: string; season: string; episode: string }>();
  const seriesIdStr = String(seriesId);
  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  /**
   * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15 — "no web, ao colocar
   * uma série em 'assistir depois' fica da cor certa do status, no
   * mobile não está") — porte fiel do `categoryColorClass` do
   * `EpisodeDetailView.tsx` do web: o botão grande de "assistido"
   * desta tela também usa a cor da categoria ATUAL da série, não uma
   * cor fixa. Esta tela nunca buscava o status da série antes.
   */
  const { status: seriesStatus } = useSeriesStatus(seriesIdNum);
  const categoryColor = getSeriesCategoryColorByStatus(seriesStatus);

  const [data, setData] = useState<EpisodePageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [seriesContext, setSeriesContext] = useState<EpisodeSeriesContext | null>(null);
  const [animeCharacters, setAnimeCharacters] = useState<FavoriteCharacterOption[]>([]);
  const [animeSearchFailed, setAnimeSearchFailed] = useState(false);

  const [watched, setWatched] = useState(false);
  const [showUnwatchedCommentWarning, setShowUnwatchedCommentWarning] = useState(false);
  const [watchedLoading, setWatchedLoading] = useState(true);

  const [myReview, setMyReview] = useState<Review | null>(null);
  const [aggregate, setAggregate] = useState<ReviewAggregate>({ average: null, count: 0, distribution: [] });

  const target = useMemo(
    () => ({ mediaType: "series" as const, mediaId: seriesIdNum, seasonNumber, episodeNumber }),
    [seriesIdNum, seasonNumber, episodeNumber]
  );
  const commentCount = useEpisodeCommentCount(target);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setWatchedLoading(true);
    fetchEpisodePage(seriesIdStr, seasonNumber, episodeNumber, locale)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        // CORREÇÃO (2026-08-26 — "motor resistente", ver seriesDetails.ts) — antes essa checagem
        // rodava em PARALELO com a busca acima, sem o ID fixo da TMDB (`result.episode.id`) à mão
        // ainda. Encadeado aqui pra poder passar o ID — checagem por ID vem primeiro dentro de
        // `isEpisodeWatched`, sobrevive a uma reestruturação de temporadas pela TMDB.
        isEpisodeWatched(seriesIdNum, seasonNumber, episodeNumber, result.episode.id)
          .then((value) => {
            if (!cancelled) {
              setWatched(value);
              setWatchedLoading(false);
            }
          })
          .catch((error) => {
            console.error("[EpisodeDetailScreen] Falha ao checar se episódio já foi assistido", error);
            if (!cancelled) setWatchedLoading(false);
          });
      })
      .catch((error) => {
        console.error("[EpisodeDetailScreen] Falha ao buscar episódio", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    fetchMyReview(target).then((value) => {
      if (!cancelled) setMyReview(value);
    });
    fetchReviewAggregate(target).then((value) => {
      if (!cancelled) setAggregate(value);
    });

    fetchEpisodeSeriesContext(seriesIdStr, seasonNumber, locale).then((value) => {
      if (cancelled) return;
      setSeriesContext(value);
      const year = value.firstAirDate ? Number(value.firstAirDate.slice(0, 4)) : null;
      // TASK-168 — `value.title` vem no idioma do app (a rota agora
      // aceita `?language=`, ver correção "idioma dos dados do
      // TMDB"); o MyAnimeList/Jikan só conhece título em
      // inglês/romaji, então buscar por `title` falharia
      // silenciosamente sempre que o app não estiver em português.
      // `matchTitle` é escolhido pra isso especificamente (título
      // alternativo em inglês do TMDB, sempre em inglês
      // independente do idioma do app, nunca exibido na tela) — ver
      // `pickTitleForExternalMatching` em apps/web/lib/tmdb/client.ts.
      // TASK-168 (correção 5, plano B — a pedido) — causa raiz de
      // verdade era instabilidade da própria Jikan (504 repetido, não
      // dá pra saber se a série é anime quando a busca falha de
      // verdade). Cair pro elenco do TMDB nesse caso mostrava foto de
      // dublador como se fosse personagem — agora `searchFailed`
      // esconde a opção inteira em vez disso.
      getAnimeCharacters(value.matchTitle, Number.isFinite(year) ? year : null).then((result) => {
        if (cancelled) return;
        setAnimeCharacters(result.characters);
        setAnimeSearchFailed(result.searchFailed);
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesIdStr, seasonNumber, episodeNumber, reloadToken, locale]);

  const { previous, next } = useMemo(() => findAdjacentEpisodes(seriesContext?.seasons, seasonNumber, episodeNumber), [seriesContext?.seasons, seasonNumber, episodeNumber]);

  const currentSeasonEpisodes = useMemo(() => {
    const currentSeason = seriesContext?.seasons.find((s) => s.seasonNumber === seasonNumber);
    return currentSeason ? [...currentSeason.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber) : [];
  }, [seriesContext?.seasons, seasonNumber]);

  /** Anime com correspondência no MyAnimeList: ilustração de verdade do personagem. Busca falhou de verdade (instabilidade externa): esconde a opção, não arrisca mostrar dublador como se fosse personagem. Sem correspondência (rodou certinho, não é anime): cai pro elenco do TMDB. */
  const favoriteCharacterOptions: FavoriteCharacterOption[] = useMemo(() => {
    if (animeCharacters.length > 0) return animeCharacters;
    if (animeSearchFailed) return [];
    return (seriesContext?.cast ?? []).map((member) => ({
      id: member.id,
      name: member.character || member.name,
      imageUrl: tmdbImageUrl(member.profilePath, "w185"),
    }));
  }, [animeCharacters, animeSearchFailed, seriesContext?.cast]);

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
    hapticTick();
    const previousValue = watched;
    setWatched(!previousValue);
    try {
      // CORREÇÃO (2026-08-26 — "motor resistente", ver seriesDetails.ts) — `data.episode.id` é o ID fixo da TMDB pra este episódio específico.
      await toggleEpisodeWatched(seriesIdNum, seasonNumber, episodeNumber, previousValue, data?.episode.id);
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
      mood: [],
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

  async function handleSetMood(mood: string[]) {
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
      await Share.share({ message: data?.episode.name ?? t("media.episodeFallback") });
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
        <PageError message={t("error.loadEpisodeFailed")} onRetry={() => setReloadToken((n) => n + 1)} />
      </Screen>
    );
  }

  const { episode: ep, watchProviders } = data;
  const stillUrl = tmdbImageUrl(ep.stillPath, "w780");
  /*
   * CORREÇÃO (2026-09-09, comparado no print) — saía "S02E10"; no web
   * (`EpisodeDetailView.tsx`) é `T${...} | E${...}`, com barra e
   * espaços, igual ao card de "Continue assistindo".
   */
  const code = `T${String(seasonNumber).padStart(2, "0")} | E${String(episodeNumber).padStart(2, "0")}`;

  return (
    <Screen padded={false}>
      {/* `bottomInset` saiu: a barra de navegação agora flutua sobre esta tela (ver `app/_layout.tsx`) e a folga do fim do conteúdo já soma a área segura, via `useTabBarClearance()`. Manter os dois empurrava o conteúdo pra cima duas vezes e ainda tirava o fundo de trás da barra, que é o que dá o efeito de vidro. */}
      {/*
        PORTE DO WEB (2026-09-09) — esta tela não tinha campo de manchas
        nenhum, e o `EpisodeDetailView.tsx` do web tem (ver `EPISODE_DETAILS_GLOW_BLOBS`).
        As manchas dele começam mais embaixo que as das telas de lista,
        porque o topo aqui é ocupado pelo herói/capa.
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={EPISODE_DETAILS_GLOW_BLOBS} />}>
      <ScrollView contentContainerStyle={{ paddingBottom: espacoDoDock }}>
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
            {/*
              MESMA CAUSA RAIZ do `SeriesHeader.tsx` (2026-09-09, print
              real — "os botões não estão transparentes"): sem
              `blurTarget` próprio, o `Glass` pega o alvo do CONTEXTO,
              que é o campo de manchas sobre base escura opaca — não a
              capa. O desfoque amostrava um retângulo chapado e o botão
              saía cinza-escuro. O alvo local abaixo faz ele desfocar a
              imagem de verdade, como o `backdrop-filter` do web.
            */}
            <BlurTargetView ref={alvoDaCapa} style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {stillUrl ? (
                <Image source={{ uri: stillUrl }} style={styles.bannerImage} contentFit="cover" />
              ) : (
                <View style={[styles.bannerImage, styles.bannerFallback]} />
              )}
              <View style={styles.bannerOverlay} />
            </BlurTargetView>
            {/*
              PORTE DO WEB (2026-09-09) — no canto superior esquerdo da
              capa o web não tem seta de voltar: tem uma PÍLULA BRANCA
              com o nome da série, que leva pra ela
              (`rounded-full bg-white px-3 py-1.5 text-xs font-bold
              uppercase tracking-wide text-black` + chevron de 14px).
              A volta continua existindo no botão do topo da tela, fora
              da capa — que é exatamente como o web organiza.
            */}
            {!!seriesContext && (
              <Pressable
                style={styles.seriesPill}
                onPress={() => router.push(`/series/${seriesIdNum}`)}
                hitSlop={8}
              >
                <Text numberOfLines={1} style={styles.seriesPillText}>
                  {seriesContext.title}
                </Text>
                <Feather name="chevron-right" size={14} color="#000000" />
              </Pressable>
            )}
            {/*
              Botão de compartilhar: no web é vidro (`border-white/15` +
              radial 0.26/0.10), que é a receita `icon`; aqui era um
              disco de scrim chapado.

              CORREÇÃO (2026-09-16, "botão pílula glass sem animação")
              — conferido no web (`EpisodeDetailView.tsx`): este botão
              usa `active:scale-90`. `Pressable` puro virou
              `PressableScale`.
            */}
            <PressableScale style={styles.shareButton} onPress={handleShare} hitSlop={8}>
              <Glass style={styles.shareGlass} variant="icon" blurTarget={alvoDaCapa}>
                <Feather name="share-2" size={16} color="#FFFFFF" />
              </Glass>
            </PressableScale>
            {/*
              A ÊNFASE ESTAVA TROCADA: aqui o código era pequeno e
              apagado e o nome era `variant="title"`. No web é o
              contrário — código em `text-xl font-bold text-white` (20px)
              e nome em `text-sm text-white/90` (14px), numa linha só.
            */}
            <View style={styles.bannerText}>
              <Text style={styles.code}>{code}</Text>
              <Text numberOfLines={1} style={styles.episodeName}>
                {ep.name}
              </Text>
            </View>
          </View>
        </GestureDetector>

        <View style={styles.body}>
          {/*
            PORTE DO WEB (2026-09-09) — aqui era só o botão de check com
            o rótulo "Marcar como assistido" ao lado. No web
            (`EpisodeDetailView.tsx`) esta faixa tem:
            data de exibição com ícone de calendário, o estado
            (olho/olho-cortado + "Assistido"/"Não assistido") e o botão
            à DIREITA, tudo em `text-xs text-muted`, com
            `border-b border-border px-4 py-3`.
            A data não aparecia em lugar nenhum da tela do mobile.
          */}
          <View style={styles.metaRow}>
            <View style={styles.metaInfo}>
              {!!ep.airDate && (
                <View style={styles.metaItem}>
                  <Feather name="calendar" size={14} color={colors.muted} />
                  <Text variant="muted" style={styles.metaText}>
                    {new Date(ep.airDate).toLocaleDateString(INTL_LOCALES[locale], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Feather name={watched ? "eye" : "eye-off"} size={14} color={colors.muted} />
                <Text variant="muted" style={styles.metaText}>
                  {watched ? t("episode.watched") : t("episode.notWatched")}
                </Text>
              </View>
            </View>
            <EpisodeWatchedButton watched={watched} onPress={handleToggleWatched} disabled={watchedLoading} size="lg" color={categoryColor} />
          </View>

          {/* "Onde assistir" — o web mostra os provedores quando o episódio NÃO foi assistido (`WhereToWatchSection`); no mobile a seção não existia nesta tela. */}
          {!watched && <SeriesWatchProviders providers={watchProviders} />}

          {watched && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("episode.whereDidYouWatch")}
              </Text>
              <EpisodeWatchedPlatformPicker providers={watchProviders} value={myReview?.watchedPlatform ?? null} onChange={handleSetPlatform} />
            </View>
          )}

          {watched && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("episode.yourRating")}
              </Text>
              <EpisodeStarRatingRow value={myReview?.rating ?? 0} onChange={handleRate} />
            </View>
          )}

          {watched && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("episode.howDidYouFeel")}
              </Text>
              <EpisodeMoodPicker value={myReview?.mood ?? []} onChange={handleSetMood} />
            </View>
          )}

          {watched && favoriteCharacterOptions.length > 0 && (
            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("episode.favoriteCharacterQuestion")}
              </Text>
              <EpisodeFavoriteCharacterPicker
                characters={favoriteCharacterOptions}
                selectedId={myReview?.favoriteCharacterId ?? null}
                onSelect={handleSetFavoriteCharacter}
              />
            </View>
          )}

          {/*
            * CORREÇÃO (auditoria de consistência web/mobile) — o web
            * mostra a nota da comunidade com ESTRELAS visuais + o
            * número em destaque (`HalfStarRating` + texto grande);
            * aqui era uma linha de texto corrido com tudo espremido
            * ("Avaliação da comunidade: 4.5/5 (12)"), bem menos
            * legível e sem nenhum peso visual. Reaproveita o
            * `StarRating` que já existe, em vez de criar componente
            * novo.
            */}
          {/*
            PORTE DO WEB (2026-09-09) — isto era texto solto no meio da
            tela. No web é uma SEÇÃO de vidro, com título próprio
            ("Informações do episódio") e a sinopse DENTRO dela:
            `rounded-lg border border-white/10 p-4 backdrop-blur-[10px]
            backdrop-saturate-[160%]` sobre radial 0.13/0.06 — a receita
            `light`.
          */}
          <Glass style={styles.infoCard} variant="light">
            <Text style={styles.infoTitle}>{t("episode.episodeInfo")}</Text>
            <View style={styles.communityBlock}>
            {aggregate.average !== null ? (
              <>
                <View style={styles.communityRow}>
                  <StarRating value={Math.round(aggregate.average)} size="sm" />
                  <Text style={styles.communityAverage}>{aggregate.average.toFixed(1)}/5</Text>
                </View>
                <Text variant="muted" style={styles.communityCaption}>
                  {t("episode.communityRating")}
                </Text>
                <Text variant="muted" style={styles.communityCaption}>
                  {aggregate.count} {aggregate.count === 1 ? t("episode.ratingSingular") : t("episode.ratingPlural")}
                </Text>
              </>
            ) : (
              <Text variant="muted" style={styles.communityCaption}>
                {t("episode.noCommunityRatingsYet")}
              </Text>
            )}
            </View>
            {/* A sinopse é o último parágrafo DESTA seção no web, não uma seção "Sinopse" separada. */}
            {!!ep.overview && <Text style={styles.overview}>{ep.overview}</Text>}
          </Glass>

          {/*
           * CORREÇÃO (a pedido — mesma mudança já aplicada no web,
           * "quero um aviso antes de entrar") — antes, cada
           * comentário escondido individualmente dizia "você ainda
           * não assistiu esse episódio". Trocado por um aviso ÚNICO
           * aqui, antes de entrar: se a pessoa ainda não marcou ESSE
           * episódio como assistido, mostra confirmação antes de
           * navegar — depois de confirmar, a tela de Comentários
           * mostra tudo normalmente (só o "contém spoiler" manual do
           * autor continua escondendo comentário individual).
           */}
          {/*
            PORTE DO WEB (2026-09-09) — era uma linha escura de vidro. No
            web é a pílula "gel" ÂMBAR do app, com texto escuro
            (`text-background`), ícone de balão e chevron, os dois em
            16px: `rounded-full border border-white/15 py-3 text-sm
            font-bold` sobre o mesmo `radial-gradient(130% 170% at 28%
            18%, ...)` dos outros botões âmbar.
          */}
          <Pressable
            onPress={() => {
              if (watched) {
                router.push(`/episodes/${seriesIdNum}/${seasonNumber}/${episodeNumber}/comments`);
              } else {
                setShowUnwatchedCommentWarning(true);
              }
            }}
          >
            <GelSurface style={styles.commentsButton} webCalibrated>
              <Feather name="message-circle" size={16} color={colors.background} />
              <Text style={styles.commentsButtonText}>
                {commentCount} {commentCount === 1 ? t("episode.commentSingular") : t("episode.commentPlural")}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.background} />
            </GelSurface>
          </Pressable>
        </View>
      </ScrollView>

      {showUnwatchedCommentWarning && (
        <OptionSheet
          title={t("episode.notWatchedTitle")}
          message={t("episode.notWatchedMessage")}
          onDismiss={() => setShowUnwatchedCommentWarning(false)}
          actions={[
            { label: t("common.cancel"), onPress: () => setShowUnwatchedCommentWarning(false) },
            {
              label: t("common.continue"),
              active: true,
              onPress: () => {
                setShowUnwatchedCommentWarning(false);
                router.push(`/episodes/${seriesIdNum}/${seasonNumber}/${episodeNumber}/comments`);
              },
            },
          ]}
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
  /** `aspect-[4/3]` no web; era altura fixa de 220. */
  banner: {
    width: "100%",
    aspectRatio: 4 / 3,
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
    backgroundColor: scrim.overImage,
  },
  /**
   * `inset-x-3 top-3` do web = 12 nas duas bordas (era `spacing.md`=16).
   * A pílula é BRANCA com texto preto: `bg-white text-black`,
   * `px-3 py-1.5` = 12/6, `text-xs font-bold uppercase tracking-wide`.
   */
  seriesPill: {
    position: "absolute",
    left: 12,
    top: 12,
    maxWidth: "70%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seriesPillText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: "#000000",
    flexShrink: 1,
  },
  /** `h-8 w-8` = 32 no web (era 36), e o disco é vidro, não scrim. */
  shareButton: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  shareGlass: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  /** `inset-x-3 bottom-3` = 12 (era 16). */
  bannerText: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  /** `text-xl font-bold text-white` = 20/700 (era 12 e apagado). */
  code: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    color: "#FFFFFF",
  },
  /** `mt-0.5 text-sm text-white/90` = 2 de respiro, 14px (era `variant="title"`). */
  episodeName: {
    marginTop: 2,
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
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
   * `flex items-center justify-between border-b border-border px-4 py-3`
   * do web. O `px-4` já vem do `body`, então aqui só o resto.
   */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 4,
  },
  /** `flex-wrap gap-x-3 gap-y-1` do web. */
  metaInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 4,
    flexShrink: 1,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  /** `text-xs` = 12. */
  metaText: {
    fontSize: 12,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    marginBottom: 2,
  },
  /** `rounded-lg p-4` do web (8 e 16); o título é `mb-3 text-sm font-semibold`. */
  infoCard: {
    borderRadius: 8,
    padding: 16,
  },
  infoTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    fontFamily: fontFamily[600],
    color: colors.text,
    marginBottom: 12,
  },
  communityBlock: {
    gap: 2,
    marginBottom: 12,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  communityAverage: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  communityCaption: {
    fontSize: fontSize.xs,
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  /** `rounded-full py-3 gap-2` do web, centralizado — não é mais uma linha com o texto esticado. */
  commentsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  /** `text-sm font-bold text-background`. */
  commentsButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    color: colors.background,
  },
});
