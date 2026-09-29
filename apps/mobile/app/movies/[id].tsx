import { useState, useMemo, useEffect } from "react";
import { ScrollView, View, Pressable, StyleSheet, Alert } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMovieDetails, useMovieStatus, useIsMovieFavorite, useMovieAddedCount } from "@/lib/useMovieDetails";
import { dismissRecommendation } from "@/lib/recommendations";
import { fetchMyReview, upsertReview, type Review } from "@/lib/social/reviews";
import { useReviewAggregate } from "@/lib/social/useReviewAggregate";
import { StarRating } from "@/components/reviews/StarRating";
import { MOVIE_DETAILS_GLOW_BLOBS } from "@/lib/glowBlobs";
import { Screen, Text, GlassTargetProvider, AmbientGlow, Glass } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { MediaDetailSkeleton } from "@/components/media/MediaDetailSkeleton";
import { MovieHeader } from "@/components/movie-detail/MovieHeader";
import { MovieQuickActionsSheet } from "@/components/movie-detail/MovieQuickActionsSheet";
import { RecommendationQuickActionsSheet } from "@/components/social/RecommendationQuickActionsSheet";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { StreamingProviders } from "@/components/movie-detail/StreamingProviders";
import { CastCarousel } from "@/components/series-detail/CastCarousel";
import { SimilarTitlesCarousel } from "@/components/media/SimilarTitlesCarousel";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { TrailerCard } from "@/components/media/TrailerCard";
import { MetaRow } from "@/components/media/MetaRow";
/**
 * A PEDIDO (2026-09-25 — "adiciona essa mesma tela dentro de 'mais' em
 * filme que tinhamos deixado pra depois") — os 3 pickers da aba "Mais"
 * de EPISÓDIO (`app/episodes/.../[episode].tsx`) são reaproveitados
 * aqui SEM MUDANÇA NENHUMA: nenhum dos três (`EpisodeWatchedPlatformPicker`/
 * `EpisodeStarRatingRow`/`EpisodeMoodPicker`) tem lógica presa a
 * episódio de verdade — são só apresentação (recebem `value`/`onChange`
 * primitivos) sobre a MESMA tabela genérica `reviews`
 * (`lib/social/reviews.ts`, `ReviewTarget.mediaType: "movie" | "series"`,
 * `season_number`/`episode_number` nulos pra review de filme/série
 * inteiros — já suportado, nenhuma migration nova). O nome "Episode*"
 * ficou, por não valer a pena duplicar/renomear só por causa do prefixo
 * — mesmo padrão que "quiz" tinha antes de sair do escopo.
 */
import { EpisodeWatchedPlatformPicker } from "@/components/episode/EpisodeWatchedPlatformPicker";
import { EpisodeStarRatingRow } from "@/components/episode/EpisodeStarRatingRow";
import { EpisodeMoodPicker } from "@/components/episode/EpisodeMoodPicker";
import { hapticTick } from "@/lib/haptics";
import { colors, spacing, fontSize, fontFamily, radius } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

type MovieDetailTab = "sobre" | "mais";

/**
 * A PEDIDO (redesenho, mockup aprovado 2026-09-25) — mesmo formato
 * usado em `SeriesHeader.tsx` pra "X avaliações": SEGURO, evita
 * `Intl.NumberFormat({ notation: "compact" })` de propósito (já
 * derrubou o Feed em produção, sem suporte garantido no Hermes
 * dependendo do build).
 */
function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} mi`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} mil`;
  return String(n);
}

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
  const [showWatchedActions, setShowWatchedActions] = useState(false);
  const [sinopseAberta, setSinopseAberta] = useState(false);

  // REDESENHO (mockup aprovado 2026-09-25) — separa "Sobre" de "Mais"
  // (que fica vazia por enquanto, a pedido explícito: "deixa a tab
  // 'mais' vazia por enquanto, vamos primeiro ajeitar 'sobre' depois
  // vamos pra ela"). Mesmo padrão de montagem de `app/series/[id].tsx`
  // (raiz do bug "trava ao trocar de aba", 2026-09-17): cada aba só
  // monta na primeira vez que aparece, e depois fica escondida
  // (`display: "none"`), nunca desmontada — evita remontar carrosséis
  // pesados (Elenco, Parecidos) a cada troca.
  const [tab, setTab] = useState<MovieDetailTab>("sobre");
  const [jaMontouSobre, setJaMontouSobre] = useState(true);
  const [jaMontouMais, setJaMontouMais] = useState(false);
  useEffect(() => {
    if (tab === "sobre") setJaMontouSobre(true);
    else setJaMontouMais(true);
  }, [tab]);

  const { movie, isLoading, isError, refetch } = useMovieDetails(movieId);
  const { status, watchedAt, busy, changeStatus, markRewatched } = useMovieStatus(numericId);
  const { isFavorite, toggle: toggleFavorite } = useIsMovieFavorite(numericId);
  const addedCount = useMovieAddedCount(numericId);
  const watched = status === "watched";

  /**
   * A PEDIDO (2026-09-25 — "muda o nome sinopse pra: informações do
   * filme... logo+estrela/avaliação+quantidade de avaliações") —
   * perguntado antes de implementar (nota do TMDB ou nossa?), porque
   * hoje mesmo o header da série trocou TMDB por nota real do
   * SeenList ("aquele número do TMDB não serve, as avaliações não
   * aparecem no SeenList de verdade" — ver `SeriesHeader.tsx`).
   * Resposta do usuário: mesmo padrão, nossa própria nota, sem logo.
   * Mesmo hook/mesma regra de exibição (`hasRealRating`) — só aparece
   * com pelo menos 1 avaliação real, senão fica escondida.
   */
  const reviewAggregate = useReviewAggregate({ mediaType: "movie", mediaId: numericId });
  const hasRealRating = !!reviewAggregate && reviewAggregate.count > 0 && reviewAggregate.average != null;

  /**
   * A PEDIDO (2026-09-25 — "adiciona essa mesma tela dentro de 'mais'
   * em filme") — porte fiel do estado de review pessoal já usado no
   * episódio (`app/episodes/.../[episode].tsx`): busca uma vez ao
   * montar (target sem `season`/`episode`, review do FILME inteiro) e
   * cada handler atualiza o estado local otimisticamente antes de
   * gravar, mesma UX. Sem `useFocusEffect` aqui — diferente do
   * episódio, nada nesta tela muda a review por fora (só os 3 pickers
   * abaixo, que já atualizam o estado local sozinhos).
   */
  const [myReview, setMyReview] = useState<Review | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchMyReview({ mediaType: "movie", mediaId: numericId }).then((review) => {
      if (!cancelled) setMyReview(review);
    });
    return () => {
      cancelled = true;
    };
  }, [numericId]);

  /**
   * Registro "vazio" com TODOS os campos de `Review` — usado só como
   * base quando `myReview` ainda é `null` (nenhuma review salva
   * ainda) e a pessoa já toca num dos pickers, pra não precisar de um
   * cast parcial (`as Review`) arriscado.
   */
  function reviewOuVazio(prev: Review | null): Review {
    return (
      prev ?? {
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
        author: { username: "", displayName: null, avatarUrl: null, verifiedTier: null },
      }
    );
  }

  function handleSetPlatform(platform: string | null) {
    setMyReview((prev) => ({ ...reviewOuVazio(prev), watchedPlatform: platform }));
    upsertReview({ mediaType: "movie", mediaId: numericId }, { watchedPlatform: platform }).catch((error) => {
      console.error("[MovieDetailScreen] Falha ao salvar plataforma", error);
    });
  }

  function handleRate(rating: number) {
    setMyReview((prev) => ({ ...reviewOuVazio(prev), rating }));
    upsertReview({ mediaType: "movie", mediaId: numericId }, { rating }).catch((error) => {
      console.error("[MovieDetailScreen] Falha ao salvar nota", error);
    });
  }

  function handleSetMood(mood: string[]) {
    setMyReview((prev) => ({ ...reviewOuVazio(prev), mood }));
    upsertReview({ mediaType: "movie", mediaId: numericId }, { mood }).catch((error) => {
      console.error("[MovieDetailScreen] Falha ao salvar humor", error);
    });
  }

  /**
   * REDESENHO (mockup aprovado 2026-09-25) — os 2 botões antigos
   * (Assistido/Assistir depois, `MovieActions.tsx`) saíram da tela;
   * o check da header (`MovieHeader.tsx`) agora É a ação de marcar.
   * Mesmo comportamento de antes quando já assistido: não desmarca
   * direto, abre "Marcar como..." (Não assistido/Reassistido) — TV
   * Time-like, já existia, só mudou de onde é disparado.
   *
   * CORREÇÃO (2026-09-25, teste no aparelho) — pedido explícito: o
   * círculo de check virou um ciclo de 3 estados, não só 2. "cor cinza
   * é o padrão (o usuário entrou na tela do filme) quando ele apertar,
   * aciona a função 'assistir depois' ... quando tiver em assistir
   * depois o botão deve ter a cor branca ... quando apertar novamente,
   * o botão fica verde/assistido." Ou seja: `null` (cinza) → toca →
   * "want_to_watch" (branco) → toca → "watched" (verde). Já assistido
   * continua abrindo "Marcar como..." (não muda).
   */
  function handleToggleWatched() {
    if (status === "watched") {
      hapticTick();
      setShowWatchedActions(true);
      return;
    }
    if (status === "want_to_watch" || status === "watching") {
      changeStatus("watched");
      return;
    }
    changeStatus("want_to_watch");
  }

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
        <MovieHeader
          movie={movie}
          status={status}
          watchedAt={watchedAt}
          busy={busy}
          onTogglePress={handleToggleWatched}
          onMorePress={() => setShowMoreOptions(true)}
        />

        {/* Abas fora de `body` — mesmo fix de `app/series/[id].tsx` (2026-09-24: "não está visualmente coerente", tabs coladas no fim da header, sem herdar o respiro vertical de `body`). */}
        <View style={styles.tabs}>
          <TabButton label={t("media.aboutTab")} active={tab === "sobre"} onPress={() => setTab("sobre")} />
          <TabButton label={t("media.moreTab")} active={tab === "mais"} onPress={() => setTab("mais")} />
        </View>

        {jaMontouSobre && (
          <View style={[styles.body, tab !== "sobre" && styles.hidden]}>
            {/* CORREÇÃO (2026-09-04, achado ao portar "onde assistir" pra
                Série — regra de padronização) — o web tem um comentário
                explícito ("onde assistir antes da sinopse, não depois do
                elenco como estava", MovieDetailsView.tsx) confirmando que
                essa posição (depois do elenco) ficou desatualizada lá em
                2026-08-25 e nunca foi replicada aqui no mobile. Movido pra
                bater com o web de verdade: logo após as ações, antes da
                sinopse. */}
            {/* `StreamingProviders` já devolve `null` quando não há provedor
                nenhum (ver `StreamingProviders.tsx`) — a seção só é
                renderizada (com a linha divisória) quando tem conteúdo de
                verdade, senão sobraria uma linha separando o nada. */}
            {movie.watchProviders.length > 0 && (
              <View style={styles.section}>
                <StreamingProviders providers={movie.watchProviders} />
              </View>
            )}

            {/* REDESENHO (mockup aprovado 2026-09-25) — "Sinopse" era texto
                solto, sem título, sem limite de linhas. Agora tem título,
                clampa em 3 linhas e um "...(ler mais)" — mesmo padrão já
                usado em `app/series/[id].tsx` (lá são 5 linhas/220
                caracteres; aqui, 3 linhas/130, pedido explícito do
                usuário: "deixar apenas 3 linhas aparecendo"). */}
            <View style={styles.section}>
              <View style={styles.overviewTitleRow}>
                <Text style={styles.overviewTitle}>{t("movie.overviewTitle")}</Text>
                {/*
                  NOVO (2026-09-25, a pedido — "logo+estrela/avaliação+
                  quantidade de avaliações", igual referência, mas com
                  nossa própria nota — ver comentário acima do hook).
                  CORREÇÃO (mesmo dia, 2 ajustes pedidos comparando com
                  o print de referência):
                  1) era um ícone de estrela solto (`MaterialCommunityIcons`)
                     fazendo de "logo" — trocado pela LOGO de verdade do
                     app (`assets/images/logo.png`, mesmo arquivo já
                     usado no selo de progresso de `SeriesHeader.tsx`).
                  2) era só 1 estrela + número — trocado pelas 5
                     estrelas de verdade (`StarRating`, modo só-exibição
                     sem `onChange`, mesmo componente do `ReviewComposer`/
                     `ReviewCard`), preenchidas de acordo com a nota
                     (ex.: 4.0 → 4 cheias, 1 vazia — igual ao print).
                  Ficou embaixo do título (não do lado) porque 5
                  estrelas + logo não cabem ao lado de "Informações do
                  filme" sem quebrar linha — mesma posição do print de
                  referência (logo abaixo do título).
                */}
                {hasRealRating && (
                  <View style={styles.overviewRatingBadge}>
                    <Image source={require("@/assets/images/logo.png")} style={styles.overviewRatingLogo} contentFit="cover" />
                    <StarRating value={Math.round(reviewAggregate!.average!)} size="sm" />
                    <Text style={styles.overviewRatingValue}>{reviewAggregate!.average!.toFixed(1)}</Text>
                    <Text style={styles.overviewRatingCount}>
                      • {t("media.ratingsCount", { count: formatCompactCount(reviewAggregate!.count) })}
                    </Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={sinopseAberta ? undefined : 3} style={styles.overview}>
                {movie.overview || t("media.noSynopsisAvailable")}
              </Text>
              {(movie.overview ?? "").length > 130 && (
                <Pressable onPress={() => setSinopseAberta((v) => !v)}>
                  <Text style={styles.readMore}>{sinopseAberta ? t("movie.readLess") : t("movie.readMore")}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("movie.technicalDetails")}
              </Text>
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
            </View>

            {!!movie.trailerKey && (
              <View style={styles.section}>
                <Text variant="subtitle" style={styles.sectionTitle}>
                  {t("media.trailer")}
                </Text>
                <TrailerCard videoKey={movie.trailerKey} />
              </View>
            )}

            {/* NOVO (mockup aprovado 2026-09-25, pedido explícito do
                usuário) — número REAL de usuários com o filme na
                biblioteca, via função no banco (`get_movie_added_count`,
                bypassa a RLS de privacidade só pra devolver o agregado). */}
            {addedCount !== null && addedCount > 0 && (
              <View style={styles.addedByRow}>
                <Feather name="users" size={16} color={colors.muted} />
                <Text variant="muted" style={styles.addedByText}>
                  {t("media.addedByCount", { count: formatCompactCount(addedCount) })}
                </Text>
              </View>
            )}

            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("media.mainCast")}
              </Text>
              <CastCarousel cast={movie.cast} />
            </View>

            <View style={styles.section}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("media.similarMovies")}
              </Text>
              <SimilarTitlesCarousel items={movie.similar} />
            </View>

            {/* A PEDIDO ("a parte de avaliações não mexe no design, deixa
                como é") — só mudou de lugar dentro do reordenamento (já
                era a última seção); o componente em si não foi tocado.
                `sectionLast` (sem linha embaixo) porque é a última seção
                da aba — nada depois pra separar. */}
            <View style={styles.sectionLast}>
              <Text variant="subtitle" style={styles.sectionTitle}>
                {t("social.reviews")}
              </Text>
              <ReviewsSection
                target={{ mediaType: "movie", mediaId: numericId }}
                media={{ title: movie.title, posterPath: movie.posterPath }}
              />
            </View>
          </View>
        )}

        {/*
          A PEDIDO (2026-09-25 — "adiciona essa mesma tela dentro de
          'mais' em filme que tinhamos deixado pra depois") — mesmas 3
          seções do episódio (`app/episodes/.../[episode].tsx`): onde
          assistiu / sua nota / como se sentiu, só aparecem depois de
          marcar assistido (mesmo gate, `watched &&`) — antes disso não
          tem review pra fazer ainda, mostra um aviso simples no lugar.
          `styles.body`/`styles.section` são os MESMOS estilos já
          usados na aba "Sobre" (linhas divisórias, respiro vertical).
        */}
        {jaMontouMais && (
          <View style={[styles.body, tab !== "mais" && styles.hidden]}>
            {watched ? (
              <>
                <View style={styles.section}>
                  <Text variant="subtitle" style={[styles.sectionTitle, styles.textCenter]}>
                    {t("episode.whereDidYouWatch")}
                  </Text>
                  <View style={styles.platformPickerWrap}>
                    <EpisodeWatchedPlatformPicker
                      providers={movie.watchProviders}
                      value={myReview?.watchedPlatform ?? null}
                      onChange={handleSetPlatform}
                    />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text variant="subtitle" style={[styles.sectionTitle, styles.textCenter]}>
                    {t("episode.yourRating")}
                  </Text>
                  <EpisodeStarRatingRow value={myReview?.rating ?? 0} onChange={handleRate} />
                </View>

                <View style={styles.section}>
                  <Text variant="subtitle" style={[styles.sectionTitle, styles.textCenter]}>
                    {t("episode.howDidYouFeel")}
                  </Text>
                  <EpisodeMoodPicker value={myReview?.mood ?? []} onChange={handleSetMood} />
                </View>

                {/* A PEDIDO (2026-09-25 — "inclui o botão de comentários que existe também na tab sobre... ambas as tabs o botão vai pra a mesma tela") — mesmo link/mesmo destino da aba Sobre (`ReviewsSection.tsx`, "Ver todas as avaliações" → `/movies/[id]/reviews`, que agora é só comentário — ver correção de hoje removendo as estrelas duplicadas de lá). */}
                <View style={styles.sectionLast}>
                  <Glass style={styles.commentsLink}>
                    <Pressable
                      style={styles.commentsLinkHit}
                      onPress={() =>
                        router.push({
                          pathname: "/movies/[id]/reviews" as const,
                          params: { id: String(numericId), title: movie.title, posterPath: movie.posterPath ?? "" },
                        })
                      }
                    >
                      <View style={styles.commentsLinkLeft}>
                        <Feather name="star" size={16} color={colors.muted} />
                        <Text style={styles.commentsLinkText}>{t("review.seeAll")}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.muted} />
                    </Pressable>
                  </Glass>
                </View>
              </>
            ) : (
              <View style={styles.placeholder}>
                <Feather name="info" size={28} color={colors.muted} />
                <Text variant="muted" style={styles.placeholderText}>
                  {t("media.moreTabComingSoon")}
                </Text>
              </View>
            )}
          </View>
        )}
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
            // CORREÇÃO (Fase 3, achado alto — "Ignorar" engolia erro em
            // silêncio, sem log nem feedback) — continua sem confirmação
            // (ação leve, por decisão do usuário); o sheet já fecha ao
            // tocar, então não há risco prático de toque duplo aqui.
            if (recId) {
              dismissRecommendation(recId).catch((error) => {
                console.error("[MovieDetailScreen] Falha ao ignorar recomendação", error);
                Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
              });
            }
            setShowRecommendationActions(false);
          }}
        />
      )}

      {showMoreOptions && (
        <MovieQuickActionsSheet
          movieId={numericId}
          movieTitle={movie.title}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          onRemoved={() => router.back()}
          onClose={() => setShowMoreOptions(false)}
        />
      )}

      {showWatchedActions && (
        <OptionSheet
          title={t("episode.markAs")}
          onDismiss={() => setShowWatchedActions(false)}
          actions={[
            {
              label: t("episode.notWatchedAction"),
              onPress: () => {
                hapticTick();
                changeStatus("watched");
                setShowWatchedActions(false);
              },
            },
            {
              label: t("episode.rewatchedAction"),
              onPress: async () => {
                hapticTick();
                setShowWatchedActions(false);
                try {
                  await markRewatched();
                } catch (error) {
                  console.error("[MovieDetailScreen] Falha ao registrar reassistido", error);
                }
              },
            },
          ]}
        />
      )}
      </GlassTargetProvider>
    </Screen>
  );
}

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
  // `paddingBottom` (herdado do `padding` antigo) e `gap` (ritmo
  // vertical entre seções) NÃO foram tocados — fora do escopo.
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  /**
   * REDESENHO (mockup aprovado 2026-09-25, pedido explícito: "adicionar
   * linhas de separação pra ficar mais organizado visualmente") — cada
   * seção da aba "Sobre" ganhou uma linha embaixo (`colors.border`),
   * igual ao mockup. A última seção (Avaliações) usa `sectionLast`
   * (sem linha — nada depois dela pra separar).
   */
  section: {
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionLast: {},
  /** Mesma receita de `ReviewsSection.tsx` (`link`/`linkHit`/`linkLeft`/`linkText`) — botão idêntico, repetido aqui na aba "Mais" (mesmo destino, `/movies/[id]/reviews`). */
  commentsLink: {
    borderRadius: radius.lg,
  },
  commentsLinkHit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  commentsLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  commentsLinkText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.sm` (era literal 14, mesmo valor).
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  /** NOVO (2026-09-25) — título + selo de nota na mesma linha, título à esquerda e o selo empurrado pra direita. */
  /** CORREÇÃO (2026-09-25, comparado com o print de referência) — era `row`/`space-between` (título e selo lado a lado); 5 estrelas + logo não cabem ao lado de "Informações do filme" sem quebrar. Vira coluna: título em cima, selo embaixo (mesma posição do print). */
  overviewTitleRow: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  /** Mesmo estilo de `series.overviewTitle` (`app/series/[id].tsx`) — único título "semibold" da tela, os outros usam `variant="subtitle"`. */
  overviewTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    fontFamily: fontFamily[600],
    color: colors.text,
  },
  /** Mesmo padrão do `ratingRow` de `SeriesHeader.tsx`, só que sobre fundo normal (não sobre a capa) — cores de texto padrão em vez de branco com sombra. */
  overviewRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  /** Mesmo tamanho/raio do `progressBadgeLogo` de `SeriesHeader.tsx` — logo de verdade do app, não um ícone genérico de estrela. */
  overviewRatingLogo: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — tokens formalizados `fontSize.xs`/`fontSize.sm` (eram literais 12/14, mesmos valores).
  overviewRatingValue: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
  overviewRatingCount: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  overview: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.text,
  },
  readMore: {
    marginTop: spacing.xs,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    fontSize: fontSize.xsPlus,
    fontWeight: "700",
    color: colors.primary,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  /**
   * A PEDIDO (2026-09-25 — "deixa tudo no meio igual a referencia") —
   * só as 3 seções novas da aba "Mais" usam isso; os outros títulos da
   * tela (Sinopse, Ficha técnica etc., aba "Sobre") continuam à
   * esquerda, sem mudança.
   */
  textCenter: {
    textAlign: "center",
  },
  /** Mesmo motivo de `platformPickerWrap` em `app/episodes/.../[episode].tsx` — o picker de plataforma é uma `ScrollView` horizontal, que fica colada à esquerda por padrão quando tem menos itens que a largura da tela. */
  platformPickerWrap: {
    alignItems: "center",
  },
  /** Bloco novo ("adicionado por X usuário(s)") — mesma linha divisória das outras seções, não um `sectionTitle`/carrossel. */
  addedByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addedByText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    fontSize: fontSize.xsPlus,
  },
  /** Abas — mesmo estilo de `app/series/[id].tsx` (fora de `body`, sem fundo, só a linha de baixo separando da header). */
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 12,
  },
  tabButtonActive: {
    borderBottomWidth: 3,
    borderBottomColor: colors.text,
  },
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
  /** Ver o comentário grande em `jaMontouSobre`/`jaMontouMais` — esconde sem desmontar, pra trocar de aba não remontar a árvore inteira. */
  hidden: {
    display: "none",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 1.6,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  placeholderText: {
    textAlign: "center",
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    fontSize: fontSize.xsPlus,
  },
});
