import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons, Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { todayLocalKey } from "@/lib/localDate";
import { Screen, Text, GlassTargetProvider, AmbientGlow, PressableScale } from "@/components/ui";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { WhatToWatchSheet } from "@/components/media/WhatToWatchSheet";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useDockVisibility } from "@/lib/useDockVisibility";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { EmptyLibraryHero } from "@/components/media/EmptyLibraryHero";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { PageError } from "@/components/media/PageError";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { HOME_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, spacing, radius, fontSize, elevation, gelBlue } from "@/lib/theme";

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/**
 * REDUZIDO (2026-10-17, feedback de revisão — "botão grande e cobrindo
 * os pôsteres, chama mais atenção que os próprios filmes") — era 56
 * (pílula com ícone+texto). Tinha virado um círculo discreto de 48px
 * (mesmo tamanho do FAB "+" do Feed, `CreatePostButton.tsx`).
 *
 * CORRIGIDO (2026-10-17, "devolver texto curto ao lado do ícone") —
 * voltou a ser pílula (altura fixa 44, menor que a original de 56),
 * então a folga reservada acompanha: 44 (botão) + spacing.md.
 *
 * CRESCIDO (2026-10-16, a pedido — "quero que cresça mais o tamanho
 * da informação") — ícone/texto maiores (ver `whatToWatchButtonText`/
 * `Feather` no JSX) pedem uma pílula mais alta pra não ficar
 * espremida; 44 → 48 (mesma altura mínima que `Button.tsx` usa,
 * `styles.base.minHeight`). A folga reservada acompanha de novo.
 */
const WHAT_TO_WATCH_BUTTON_CLEARANCE = 48 + spacing.md;

/**
 * NOVO (2026-10-16, a pedido — "não quero que o botão tenha
 * transparência, quero que ele fique bem visível e chamativo") —
 * mesma paleta azul de `gelBlue.gradientCalibrated` (mesmos matizes,
 * mesmas 4 paradas), só com alfa 1 em vez de 0.86-0.9. `gelBlue` fica
 * intocado (usado de propósito, com transparência, nas abas "Minha
 * Lista"/"Em breve" e no resto do app) — esta constante é só pra esta
 * pílula flutuante, que precisa de cor SÓLIDA pra não mudar de
 * intensidade dependendo do pôster por baixo.
 */
const WHAT_TO_WATCH_GRADIENT = ["rgb(90,165,235)", "rgb(68,142,222)", "rgb(61,129,185)", "rgb(39,96,149)"] as const;

function isReleased(releaseDate: string | null | undefined, todayKey: string): boolean {
  if (!releaseDate) return true; // sem data conhecida — trata como já lançado, mesmo padrão de "year: null" já usado no resto do app.
  return releaseDate <= todayKey;
}

/** Ver `styles.listRowSeparator`, abaixo — componente fora do corpo de `MoviesScreen` pra não ser recriado a cada render (mesma identidade sempre, embora aqui isso não afete memoização nenhuma — é só o jeito correto de declarar um `ItemSeparatorComponent` fixo). */
function ListRowSeparator() {
  return <View style={styles.listRowSeparator} />;
}

function upcomingLabel(releaseDate: string, todayKey: string, t: TFunction, dateFormatter: Intl.DateTimeFormat): string {
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${releaseDate}T00:00:00`);
  const daysUntil = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (daysUntil === 0) return t("moviesHome.releasesToday");
  if (daysUntil === 1) return t("moviesHome.releasesTomorrow");
  if (daysUntil <= 30) return t("moviesHome.releasesInDays", { days: daysUntil });
  return t("moviesHome.releasesOn", { date: dateFormatter.format(target) });
}

/**
 * TASK-099 (correção — pedido do usuário) — tirei a categoria
 * "Assistindo" daqui. Diferente do web (que mantém as 3 categorias
 * lado a lado), a decisão pra este app é que filme não tem estado
 * "assistindo" que faça sentido mostrar como lista — só série tem
 * episódios/progresso pra acompanhar aos poucos. Filme é "quero
 * assistir" ou já foi assistido (o que muda o status pra "completed"
 * automaticamente, some daqui). Também removi o título "Filmes" no
 * topo — a barra de abas embaixo já diz em qual tela você está.
 *
 * TASK-148 (a pedido — diverge do web de propósito) — "Em breve" pro
 * web é um placeholder intencional (não existe conceito recorrente
 * de "próximo lançamento" pra filme, diferente de série). A pedido,
 * construído aqui mesmo assim: filme "Assistir depois" com data de
 * lançamento no futuro sai de "Assistir depois" e vai pra "Em breve"
 * automaticamente — sem precisar de nada manual.
 */
export default function MoviesScreen() {
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  // NOVO (a pedido, 2026-10-16 — "em todas as telas adiciona a barra de navegações o esconder ao rolar") — ver `lib/useDockVisibility.tsx`.
  const { reportDockScroll, resetDockVisible } = useDockVisibility();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  // NOVO (a pedido, 2026-10-15 — "O que assistir?"). Ver `components/media/WhatToWatchSheet.tsx` pro resto da feature.
  const [whatToWatchOpen, setWhatToWatchOpen] = useState(false);
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("movies-library");
  const { t, locale } = useTranslation();
  /**
   * NOVO (a pedido, 2026-10-17 — "mesmo design das pílulas 'Minha
   * Lista' [a cápsula 'gel'], porém com uma cor nova e uma animação
   * que indique que o usuário deve pressionar", mockups aprovados:
   * cor azul — a MESMA já usada em `gelBlue`/"Em breve" — ícone de
   * embaralhar, frase "Escolhe pra mim", só o anel de pulso (sem a
   * animação de "respirar"/escala que foi testada e descartada)) —
   * anel que expande e desaparece atrás da pílula, em loop. Usa o
   * `Animated` do próprio React Native (não Reanimated) porque é
   * exatamente o mesmo padrão já usado por `PressableScale.tsx`
   * (`useRef(new Animated.Value(...))` + `Animated.timing`), sem
   * introduzir uma segunda biblioteca de animação só pra isto.
   */
  const reducedMotion = useReducedMotion();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return; // RESPEITA a preferência de "reduzir movimento" do aparelho — mesmo padrão já usado na tela de emblemas (ver `app/profile/achievements/[id].tsx`).
    pulseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, pulseAnim]);

  /**
   * CAUSA RAIZ (2026-10-16, a pedido — "ao mudar de aba interna ele
   * trava a animação") — `.interpolate(...)` chamado direto no corpo
   * do componente cria um objeto NOVO em TODO re-render (identidade
   * diferente a cada vez), mesmo quando `pulseAnim` não mudou. Com
   * `useNativeDriver: true`, isso é um gatilho conhecido de a
   * animação "travar"/resetar quando o componente re-renderiza por um
   * motivo não relacionado — exatamente o caso aqui: trocar a aba
   * INTERNA ("Minha Lista"/"Em breve") muda o estado `tab`, que
   * re-renderiza este componente inteiro, recriando `pulseScale`/
   * `pulseOpacity` no meio do loop nativo já em andamento. (Trocar a
   * aba da BARRA DE NAVEGAÇÃO não tem esse efeito porque desmonta a
   * tela inteira, não é um re-render "no meio".) `useMemo` com
   * dependência só em `pulseAnim` garante a MESMA identidade de
   * objeto entre renders, então o loop nativo não é perturbado.
   */
  const pulseScale = useMemo(
    () => pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }),
    [pulseAnim]
  );
  // Opacidade cai mais rápido que a escala sobe (0 → 0.7 já quase zerado) — reproduz o `70% { opacity: 0 }` do mockup CSS: o anel "some" antes de terminar de crescer, em vez de desaparecer só bem no fim.
  const pulseOpacity = useMemo(
    () => pulseAnim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0.55, 0.25, 0, 0] }),
    [pulseAnim]
  );
  /**
   * PORTE DO WEB (2026-09-03, mesma auditoria — `movies-home/
   * MinhaListaSection.tsx`, empty state de "Assistir depois") —
   * mesma receita de `series/index.tsx`: fileira "Populares no
   * SeenList" (`trending_movies`) embaixo do card vazio, reaproveitando
   * `DiscoverCarousel`/`useDiscoverList` já usados no Explorar. Título
   * reaproveita a MESMA chave `seriesHome.popularSeries` — o texto já
   * é genérico de propósito no original (marca do app, não
   * "séries populares"), mesma decisão do web.
   */
  const trendingMovies = useDiscoverList("trending_movies");
  /**
   * ESTABILIZADO (2026-09-17, réplica do fix do Perfil/Séries — "pode
   * replicar nas outras abas") — mesmo raciocínio de
   * `popularSeriesTitle` em `series/index.tsx`: `DiscoverCarousel`
   * agora é `memo()`, e sem fixar a identidade deste título com
   * `useMemo` ele seria um elemento JSX novo a cada render desta tela,
   * nunca "igual" na comparação rasa do `memo()`.
   */
  const popularMoviesTitle = useMemo(
    () => (
      <View style={styles.flameTitleRow}>
        <Ionicons name="flame" size={16} color={colors.primary} />
        <Text variant="subtitle" style={{ color: colors.primary }}>
          {t("seriesHome.popularSeries")}
        </Text>
      </View>
    ),
    [t]
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "long", year: "numeric" }),
    [locale]
  );

  const todayKey = useMemo(() => todayLocalKey(), []);

  const allWantToWatch = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "want_to_watch"),
    [items]
  );

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-10-06, bug reportado com print —
   * "os filmes não estão mostrando na sequência certa, estão
   * aparecendo misturados... últimos filmes adicionados a lista
   * 'patriota e medieval'") — a lista nunca tinha ordenação PRÓPRIA
   * aqui; a ordem que aparecia era a que sobrava de
   * `fetchLibraryItems`/`buildLibraryItemsFromRows`
   * (`lib/library.ts`), que busca `movie_status` ordenado por
   * `.order("movie_id", { ascending: true })` — ordem elaborada só
   * pra paginação funcionar direito (evitar linha duplicada/faltando
   * entre páginas de 1000, ver comentário lá), nunca pensada como
   * ordem de EXIBIÇÃO. `movie_id` é o id do TMDB (o filme em si), sem
   * nenhuma relação com QUANDO a pessoa adicionou à lista — por isso
   * "Patriota"/"Medieval" (adicionados por último) apareciam no meio
   * do grid, na posição que o id numérico deles calhasse de cair.
   * Ordenado aqui por `createdAt` decrescente — adicionado mais
   * recentemente aparece primeiro, mesmo critério intuitivo de
   * qualquer lista "a seguir".
   */
  const wantToWatch = useMemo(
    () =>
      allWantToWatch
        .filter((item) => isReleased(item.releaseDate, todayKey))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allWantToWatch, todayKey]
  );

  const upcoming = useMemo(
    () =>
      allWantToWatch
        .filter((item) => !isReleased(item.releaseDate, todayKey))
        .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "")),
    [allWantToWatch, todayKey]
  );

  /*
   * CORREÇÃO (2026-09-10, mesmo achado do `series/index.tsx` —
   * "continue assistindo/switch de grid e lista aparecendo na
   * emptystate") — no web (`movies-home/MinhaListaSection.tsx`), o
   * cabeçalho (título "Assistir depois" + alternância grade/lista)
   * fica dentro de `{!isEmptyState && (...)}`, some quando a lista
   * está vazia porque o `EmptyLibraryHero` já tem título próprio.
   */
  const isEmptyState = viewModeReady && !isLoading && wantToWatch.length === 0;

  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-17, a pedido — mesmo achado já
   * corrigido em "Assistir depois"/"Completadas"/"Interrompidas" de
   * Séries, ver `FilteredSeriesListScreen.tsx`) — "Quero assistir" e
   * "Em breve" eram desenhados com `PosterGrid` (`View`+`.map()`, sem
   * limite), dentro de um `ScrollView`: TODOS os pôsteres eram
   * desenhados de uma vez, cada um com seu próprio `Glass` (blur
   * nativo de verdade no Android), mesmo os que nunca chegam a aparecer
   * na tela sem rolar bastante. "Quero assistir" cresce com o uso do
   * app (o usuário marca mais filmes do que assiste, sem limpar a
   * lista sozinho) — igual às listas de Séries que já tinham essa
   * correção. Os dois `ScrollView` viraram `FlatList` virtualizada
   * (só desenha o que está perto da área visível), usando os mesmos
   * `PosterGridItem`/`usePosterCardWidth` que a versão de Séries já
   * usa. `key` no `FlatList` muda com `viewMode` de propósito: o React
   * Native não permite trocar `numColumns` numa lista já montada (dá
   * erro em runtime) — mudar a `key` força remontar a lista quando o
   * usuário alterna grade/lista, o mesmo padrão de qualquer lista que
   * alterna colunas dinamicamente.
   */
  const cardWidth = usePosterCardWidth();

  // NOVO (a pedido, 2026-10-15 — "O que assistir?") — só faz sentido
  // sugerir um filme da lista quando ela já carregou e tem pelo menos
  // 1 item; "Em breve" fica de fora de propósito (filme com estreia
  // futura ainda não dá pra assistir).
  const showWhatToWatchButton = tab === "minha-lista" && viewModeReady && !isLoading && wantToWatch.length > 0;
  /**
   * CORREÇÃO (2026-10-16, a pedido — vídeo mostrando "ao troca de aba
   * interna a animação para") — CAUSA RAIZ: a `View` do botão+anel de
   * pulso era renderizada via `{showWhatToWatchButton && (...)}` — ou
   * seja, trocar de "Minha Lista" pra "Em breve" DESMONTAVA a `View`
   * inteira (não só escondia), destruindo o nó nativo que a animação
   * (`pulseAnim`, `useNativeDriver: true`) estava desenhando. Ao voltar
   * pra "Minha Lista", a `View` era recriada do zero — por fora parece
   * "a animação parou (e reapareceu com um corte seco)", mesmo o valor
   * `pulseAnim` em si nunca tendo parado de rodar (o loop, no
   * `useEffect` acima, não depende de `tab`).
   *
   * Esta constante separa "pode existir" (`!isLoading && wantToWatch.
   * length > 0`, independente da aba) de "deve aparecer agora"
   * (`showWhatToWatchButton`, que também exige `tab === "minha-lista"`).
   * A `View` abaixo passa a usar ESTA pra decidir se MONTA, e
   * `showWhatToWatchButton` só pra esconder via `opacity`/
   * `pointerEvents` — nunca mais desmonta por causa da aba, então o
   * anel de pulso nunca "para": continua girando por baixo, invisível,
   * e reaparece exatamente de onde tinha ficado.
   */
  const canRenderWhatToWatchButton = !isLoading && wantToWatch.length > 0;

  /**
   * NOVO (a pedido, 2026-10-16 — "ao rolar a lista de filmes pra cima
   * o botão se esconder, e ao rolar de volta pra baixo reaparecer")
   * — padrão clássico de FAB que soma ao scroll: some rolando PRA
   * BAIXO na lista (conteúdo sobe, offset cresce — mais conteúdo
   * sendo lido, o botão só atrapalharia), reaparece rolando de volta
   * PRA CIMA (offset cai — intenção de voltar/revisar, mais provável
   * precisar do botão de novo).
   *
   * `whatToWatchScrollHidden` é o estado "achatado" (só true/false,
   * sem valor contínuo) que decide a ANIMAÇÃO — ver o `useEffect`
   * logo abaixo, que dispara o `Animated.timing` de verdade
   * (`whatToWatchVisible`) toda vez que esse booleano muda. Separar
   * os dois (estado discreto vs. valor animado contínuo) é o MESMO
   * padrão já usado em `showWhatToWatchButton`/`canRenderWhatToWatchButton`
   * acima: o handler de scroll dispara a cada frame rolado, então
   * precisa ser barato (só compara e, no máximo, troca um booleano);
   * quem anima de verdade é o efeito, só quando o booleano realmente
   * vira.
   */
  const [whatToWatchScrollHidden, setWhatToWatchScrollHidden] = useState(false);
  const lastMinhaListaScrollYRef = useRef(0);
  const whatToWatchVisible = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(whatToWatchVisible, {
      toValue: whatToWatchScrollHidden ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [whatToWatchScrollHidden, whatToWatchVisible]);

  /**
   * CORREÇÃO DE CAUSA RAIZ — sem isto, trocar pra "Em breve" e voltar
   * pra "Minha Lista" (ver `canRenderWhatToWatchButton`/
   * `showWhatToWatchButton` acima — a `FlatList` de "Minha Lista" É
   * DESMONTADA ao trocar de aba, porque o `tab === "minha-lista" ?`
   * logo abaixo troca pra um `FlatList` DIFERENTE, não é a mesma
   * remontada) deixaria o botão preso "escondido" (se a pessoa tivesse
   * rolado pra baixo antes de trocar de aba), mesmo a lista
   * reaparecendo do TOPO (toda `FlatList` nova começa com offset 0) —
   * o estado daqui não sabia disso sozinho. Zera os dois junto com a
   * entrada na aba.
   */
  useEffect(() => {
    if (tab === "minha-lista") {
      lastMinhaListaScrollYRef.current = 0;
      setWhatToWatchScrollHidden(false);
    }
    // NOVO (a pedido, 2026-10-16) — a troca de aba interna ("Minha
    // Lista"/"Em breve") remonta a FlatList com offset 0 (ver comentário
    // acima sobre `canRenderWhatToWatchButton`), e a barra de navegação
    // precisa saber disso também — senão ficaria presa "escondida" numa
    // lista que acabou de reaparecer do topo.
    resetDockVisible();
  }, [tab, resetDockVisible]);

  const handleMinhaListaScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const delta = y - lastMinhaListaScrollYRef.current;
    lastMinhaListaScrollYRef.current = y;
    if (y <= 8) {
      // Perto do topo — sempre visível, independente da direção (evita
      // ficar escondido por um "overscroll" pequeno logo no início).
      setWhatToWatchScrollHidden(false);
      return;
    }
    if (Math.abs(delta) < 4) return; // ignora tremor mínimo (não é rolagem de verdade).
    setWhatToWatchScrollHidden(delta > 0);
    // NOVO (a pedido, 2026-10-16) — a mesma rolagem que esconde/mostra o
    // botão "Escolhe pra mim" agora também esconde/mostra a barra de
    // navegação (ver `lib/useDockVisibility.tsx`).
    reportDockScroll(event);
  }, [reportDockScroll]);

  const whatToWatchTranslateY = useMemo(
    () => whatToWatchVisible.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }),
    [whatToWatchVisible]
  );
  // Multiplica pelo "existe nesta aba" (0/1 simples, sem animação própria — ver comentário de `canRenderWhatToWatchButton`): escondido pela aba E escondido pelo scroll são dois motivos independentes, o botão só aparece quando NENHUM dos dois está ativo.
  const whatToWatchOpacity = useMemo(
    () => Animated.multiply(whatToWatchVisible, showWhatToWatchButton ? 1 : 0),
    [whatToWatchVisible, showWhatToWatchButton]
  );

  const handlePressItem = useCallback(
    (item: LibraryItem) => {
      router.push(`/movies/${item.id}`);
    },
    [router]
  );

  return (
    <Screen padded={false}>
      {/*
        PORTE DO WEB (2026-09-09) — esta tela não tinha campo de manchas
        nenhum, e o `SeriesHome.tsx`/`MoviesHome.tsx` do web tem (cinco
        manchas, ver `HOME_GLOW_BLOBS`). Mesmo padrão já usado em
        Explorar/Perfil: o `GlassTargetProvider` envolve a tela inteira
        e é também o alvo de desfoque de qualquer `Glass` que venha a
        existir aqui.
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={HOME_GLOW_BLOBS} />}>
      <View style={styles.tabsRow}>
        <HomeTabs active={tab} onChange={setTab} />
      </View>

      {tab === "minha-lista" ? (
        isError ? (
          <View style={styles.content}>
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          </View>
        ) : !viewModeReady ? (
          // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
          // instante" — ver `useViewModePreference.ts`).
          null
        ) : isLoading ? (
          <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
        ) : (
          <FlatList
            key={`minha-lista-${viewMode}`}
            data={wantToWatch}
            keyExtractor={(item) => `${item.mediaType}-${item.id}`}
            numColumns={viewMode === "grid" ? 3 : 1}
            columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
            // NOVO (a pedido, 2026-10-16 — "esconder o botão rolando pra cima, reaparecer rolando de volta pra baixo") — ver `handleMinhaListaScroll` acima.
            onScroll={handleMinhaListaScroll}
            scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
            contentContainerStyle={[
              styles.content,
              // NOVO (2026-10-15) — respiro extra pro botão flutuante "O que assistir?" não cobrir a última fileira de pôsteres.
              { paddingBottom: tabBarClearance + (showWhatToWatchButton ? WHAT_TO_WATCH_BUTTON_CLEARANCE : 0) },
            ]}
            ListHeaderComponent={
              !isEmptyState ? (
                <View style={styles.sectionHeader}>
                  {/*
                    * A PEDIDO (2026-10-01 — "deixa o 'assistir a seguir'
                    * de séries e filmes sem ser pílula") — era
                    * `<SectionTitle>` (a cápsula de vidro maiúscula
                    * portada do web em 2026-09-09). Trocado por
                    * `Text variant="subtitle"`, o mesmo título "comum"
                    * já usado nas telas-irmãs "Ver tudo"
                    * (`continue-assistindo.tsx`/
                    * `continue-de-onde-parou.tsx`).
                    */}
                  <Text variant="subtitle">{t("moviesHome.watchlist")}</Text>
                  <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              /*
                PORTE DO WEB (2026-09-10, auditoria — "Assistir depois"
                vazio) — o `EmptyShelf` (card com borda tracejada) saiu
                daqui: o web usa o `EmptyLibraryHero` (ilustração + título
                + subtítulo + botão + divisor "OU"), solto direto em cima
                do fundo, sem card nenhum em volta. Ver o componente novo
                (`EmptyLibraryHero.tsx`) pro porte completo.
              */
              <>
                <EmptyLibraryHero
                  title={t("moviesHome.emptyWatchlistTitle")}
                  subtitle={t("moviesHome.emptyWatchlistSubtitle")}
                  actionLabel={t("moviesHome.exploreMovies")}
                  actionHref="/(tabs)/explore"
                  dividerLabel={t("seriesHome.or")}
                />
                {/** `mt-2` do web entre o divisor e a fileira "Populares". */}
                <View style={styles.popularSection}>
                  <DiscoverCarousel
                    title={popularMoviesTitle}
                    items={trendingMovies.items}
                    isLoading={trendingMovies.isLoading}
                    viewAllHref="/explore/all/trending_movies"
                  />
                </View>
              </>
            }
            ItemSeparatorComponent={viewMode === "list" ? ListRowSeparator : undefined}
            renderItem={({ item }) =>
              viewMode === "grid" ? (
                // NOVO (2026-10-15) — `showRating`: só esta FlatList (Filmes → Minha Lista → Assistir a seguir) liga o selo; "Em breve" (abaixo) e o resto do app ficam de fora, de propósito (ver comentário em `PosterGrid.tsx`).
                <PosterGridItem item={item} onPress={handlePressItem} cardWidth={cardWidth} showRating />
              ) : (
                <MediaListRow item={item} onPress={handlePressItem} secondaryText={item.year ? String(item.year) : ""} />
              )
            }
          />
        )
      ) : isError ? (
        <View style={styles.content}>
          <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
        </View>
      ) : !viewModeReady ? (
        // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
        // instante" — ver `useViewModePreference.ts`).
        null
      ) : isLoading ? (
        <View style={styles.content}>{viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />}</View>
      ) : (
        <FlatList
          key={`em-breve-${viewMode}`}
          data={upcoming}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={viewMode === "grid" ? 3 : 1}
          columnWrapperStyle={viewMode === "grid" ? styles.gridRow : undefined}
          // NOVO (a pedido, 2026-10-16) — "Em breve" não tem o botão
          // "Escolhe pra mim" (só aparece em "Minha Lista"), mas agora
          // precisa esconder/mostrar a barra de navegação ao rolar — ver
          // `lib/useDockVisibility.tsx`.
          onScroll={reportDockScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          ListHeaderComponent={
            /*
              CORREÇÃO (2026-09-10, auditoria web — `EmBreveSection.tsx`)
              — o web NÃO mostra título nenhum nesta aba, só o alternador
              grade/lista alinhado à direita (`mb-2 flex items-center
              justify-end`). Tinha um `SectionTitle` aqui que o web não
              tem.
            */
            <View style={styles.upcomingHeader}>
              <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            </View>
          }
          ListEmptyComponent={<EmptyShelf message={t("moviesHome.emptyUpcoming")} />}
          ItemSeparatorComponent={viewMode === "list" ? ListRowSeparator : undefined}
          renderItem={({ item }) =>
            viewMode === "grid" ? (
              <PosterGridItem item={item} onPress={handlePressItem} cardWidth={cardWidth} />
            ) : (
              <MediaListRow
                item={item}
                onPress={handlePressItem}
                secondaryText={item.releaseDate ? upcomingLabel(item.releaseDate, todayKey, t, dateFormatter) : ""}
              />
            )
          }
        />
      )}

      {/*
        NOVO (a pedido, 2026-10-15 — "O que assistir?") — mesmo
        esqueleto de posicionamento do "+" flutuante do Feed
        (`CreatePostButton.tsx`: `position:"absolute"`, `bottom:
        tabBarClearance`), só que centralizado (sem `right`) e em
        formato pílula com texto, não círculo.
      */}
      {canRenderWhatToWatchButton && (
        <Animated.View
          style={[
            styles.whatToWatchWrapper,
            {
              bottom: tabBarClearance,
              opacity: whatToWatchOpacity,
              transform: [{ translateY: whatToWatchTranslateY }],
            },
          ]}
          pointerEvents={showWhatToWatchButton && !whatToWatchScrollHidden ? "box-none" : "none"}
        >
          {!reducedMotion && (
            <Animated.View
              pointerEvents="none"
              style={[styles.whatToWatchPulseRing, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
            />
          )}
          <PressableScale
            hitSlop={8}
            style={styles.whatToWatchButton}
            onPress={() => setWhatToWatchOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("whatToWatch.button")}
          >
            {/*
              CORREÇÃO (2026-10-16, a pedido — "o botão está com um novo bug,
              antes não tinha nada, agora está como no print" [cantos quadrados
              por dentro de um contorno arredondado]) — CAUSA RAIZ: limitação
              conhecida do React Native/Android — `elevation` (sombra) e
              `overflow: "hidden"` + `borderRadius` NO MESMO `View` fazem o
              Android ignorar o recorte arredondado (o degradê interno passa a
              vazar nos cantos quadrados, enquanto a SOMBRA, desenhada por
              fora, continua arredondada — exatamente o que o print mostrava:
              contorno redondo por fora, caixa quadrada por dentro).
              Confirmado comparando com o resto do app: `GelSurface`/`gelWrap`
              (`Glass.tsx`) e `Button.tsx` (variant primary) NUNCA combinam
              sombra com o `View` que recorta o degradê; `CreatePostButton.tsx`
              (`fab`) combina sombra+`borderRadius`, mas não tem conteúdo
              interno recortado (`overflow: "hidden"`), por isso nunca bateu
              nesse bug.

              CORREÇÃO: a sombra fica no `Pressable` de fora
              (`styles.whatToWatchButton`, sem `overflow`/padding/borda
              nenhuma agora); o recorte arredondado (`overflow: "hidden"` +
              `borderRadius` + borda + o degradê) passa pra este `View` novo,
              de dentro — mesmo padrão já usado em `Button.tsx`
              (`PressableScale` por fora, `GelSurface` por dentro, sem sombra).
            */}
            <View style={styles.whatToWatchInner}>
              {/*
                CORREÇÃO (2026-10-16, a pedido — vídeo + "eu não quero que o
                botão tenha transparência, quero que ele fique bem visível e
                chamativo") — CAUSA RAIZ: `gelBlue.gradientCalibrated` usa
                `rgba(...)` com alfa 0.86-0.9 em TODAS as paradas (pensado pro
                efeito "vidro" das abas, onde um pouco do fundo atrás deveria
                mesmo transparecer). Usado aqui (botão flutuante por cima de
                pôsteres claros/escuros variados), esse alfa deixa a cor mudar
                de intensidade dependendo do que está por baixo — exatamente
                o "transparente"/"sem destaque" reportado, e também a provável
                causa do texto "bugado" no vídeo anterior: o anel de pulso
                (`pulseOpacity`/`pulseScale`, anima atrás da pílula) passava a
                transparecer por baixo do degradê translúcido, interferindo
                visualmente com o texto por cima durante a animação.
                `WHAT_TO_WATCH_GRADIENT` abaixo é a MESMA paleta azul, só com
                alfa 1 (opaco) — não mexe no token `gelBlue` compartilhado
                (ainda usado, de propósito, nas abas "Minha Lista"/"Em breve"
                e no resto do app), só nesta pílula.
              */}
              <LinearGradient
                colors={WHAT_TO_WATCH_GRADIENT}
                locations={gelBlue.gradientCalibratedLocations}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={styles.whatToWatchInsetShineTop} pointerEvents="none" />
              <LinearGradient
                colors={[gelBlue.insetBottom, "rgba(0,0,0,0)"]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0.55 }}
                style={styles.whatToWatchInsetShineBottom}
                pointerEvents="none"
              />
              {/*
                CORREÇÃO (mesma causa raiz já documentada em `PressableScale.tsx`
                — o `Animated.View` interno embrulha os filhos sem
                `flexDirection: "row"`, herda o padrão `"column"` do React
                Native) — sem este `View` próprio, ícone e texto empilhariam
                um sobre o outro em vez de lado a lado.
              */}
              <View style={styles.whatToWatchButtonContent}>
                <Feather name="shuffle" size={20} color="#fff" />
                <Text style={styles.whatToWatchButtonText}>{t("whatToWatch.button")}</Text>
              </View>
            </View>
          </PressableScale>
        </Animated.View>
      )}
      </GlassTargetProvider>

      {whatToWatchOpen && <WhatToWatchSheet items={wantToWatch} onClose={() => setWhatToWatchOpen(false)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** O provedor precisa ocupar a tela toda pras manchas cobrirem tudo — mesmo estilo de `explore.tsx`/`profile.tsx`. */
  glassFill: {
    flex: 1,
  },
  tabsRow: {
    paddingTop: spacing.sm,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  /** `mb-3` = 12 no web (`MinhaListaSection.tsx`); estava `spacing.sm` = 8 (mesma correção já feita em `series/index.tsx`). */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  /** `mb-2 flex items-center justify-end` do `EmBreveSection.tsx` — sem título, só o alternador à direita. */
  upcomingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: spacing.sm,
  },
  /** Espaçamento entre pôsteres de fileiras diferentes no grid — mesmo valor de `FilteredSeriesListScreen.tsx`. */
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  /** `ItemSeparatorComponent` do modo lista — reproduz o `gap: spacing.sm` que o `View` antigo (`listRows`) tinha ENTRE os itens, sem sobrar espaço depois do último (o que `marginBottom` por item deixaria). */
  listRowSeparator: {
    height: spacing.sm,
  },
  // Mesma margem negativa de `series/index.tsx` (ver comentário lá) —
  // `DiscoverCarousel` já tem seu próprio `paddingHorizontal`, e esta
  // tela já envolve tudo num `ScrollView` com `styles.content` pado.
  // CORREÇÃO (2026-09-03) — `marginHorizontal` era `-spacing.lg` pra
  // cancelar exatamente o `paddingHorizontal` do `content` (acima);
  // como o `content` virou `spacing.md`, esta margem precisa
  // acompanhar — senão o carrossel ficaria com 8px de respiro extra
  // (ou faltando) na borda em relação ao resto da tela.
  /**
   * CORREÇÃO (2026-09-10, agora que o vazio usa `EmptyLibraryHero`) —
   * `marginTop` era `spacing.lg` (24, distância do CARD antigo do
   * `EmptyShelf`); o web usa `mt-2` (8) entre o divisor "OU" e a
   * fileira "Populares", medido a partir do `EmptyLibraryHero.tsx`.
   */
  popularSection: {
    marginTop: spacing.sm,
    marginHorizontal: -spacing.md,
  },
  flameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  /**
   * NOVO (2026-10-17, redesign do botão — ver comentário grande no
   * JSX) — `View` posicionada (antes era a própria `PressableScale`
   * que carregava `position: absolute`); precisou virar um wrapper à
   * parte porque agora tem DOIS filhos empilhados no mesmo lugar (o
   * anel de pulso, atrás, e a pílula, na frente) — `position:
   * absolute` só pode valer pra um deles se os dois dividirem o MESMO
   * `bottom`/`alignSelf`, daí subir pro pai comum.
   */
  whatToWatchWrapper: {
    position: "absolute",
    alignSelf: "center",
  },
  /**
   * O anel de pulso em si — um `View` do MESMO tamanho/raio da pílula
   * (preenche o wrapper todo via `StyleSheet.absoluteFillObject`),
   * cor sólida do azul `gelBlue` (sem degradê — só precisa comunicar
   * "pulso", não replicar o gel). `pulseOpacity`/`pulseScale` (ver
   * acima) fazem ele crescer e sumir, em loop — igual ao `box-shadow`
   * que se expande do mockup CSS, só que via `transform`/`opacity`
   * (RN não anima `box-shadow`).
   */
  whatToWatchPulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.full,
    backgroundColor: "rgba(90,165,235,0.55)",
  },
  /**
   * REDESENHADO (2026-10-17) — era uma pílula dimensionada pelo
   * conteúdo; depois virou um círculo de tamanho fixo (receita do FAB
   * "+" do Feed, `CreatePostButton.tsx`, `styles.fab`), só ícone.
   * Depois voltou a ser pílula ícone+texto, chapada em âmbar
   * (`backgroundColor: colors.primary`).
   *
   * REDESENHADO DE NOVO (2026-10-17, cor gel azul — ver comentário
   * grande no JSX) — `backgroundColor` saiu: quem pinta agora é o
   * `LinearGradient` (camada absoluta, como no `GelSurface`).
   *
   * CORREÇÃO (2026-10-16, causa raiz documentada no JSX acima, onde o
   * `whatToWatchInner` é usado) — este `View` (o `Pressable` de fora,
   * via `PressableScale`) ficou só com a SOMBRA. `overflow: "hidden"`
   * + `borderRadius` + borda + o degradê moraram aqui até o bug dos
   * cantos quadrados; agora moram em `whatToWatchInner`, de dentro.
   * `borderRadius` continua aqui também (sem `overflow`) só pra sombra
   * do Android (`elevation`) desenhar com o contorno arredondado certo
   * — sem isso a sombra sairia quadrada, mesmo com o conteúdo redondo.
   */
  whatToWatchButton: {
    borderRadius: radius.full,
    shadowColor: elevation.high.shadowColor,
    shadowOpacity: elevation.high.shadowOpacity,
    shadowRadius: elevation.high.shadowRadius,
    shadowOffset: elevation.high.shadowOffset,
    elevation: elevation.high.elevation,
  },
  /**
   * NOVO (2026-10-16) — o recorte arredondado de verdade (ver causa
   * raiz no comentário do JSX). Igual ao antigo `whatToWatchButton`
   * (mesma altura/padding/borda/`overflow`), só sem sombra — a sombra
   * ficou no `Pressable` de fora (`whatToWatchButton`, acima). Mesmo
   * papel que o `gelWrap` (`Glass.tsx`) faz pro `GelSurface`: a borda
   * por lado (`gelBlue.border`) é cor já COMPOSTA (branco 15% sobre o
   * degradê naquele lado), não um `rgba` com alfa, porque um filho
   * absoluto recortado por `overflow: hidden` não alcança a borda pra
   * compor com ela de verdade.
   *
   * CORREÇÃO (2026-10-16, a pedido — print real, "o nome dentro do
   * botão não está ficando centralizado, continua ficando mais no
   * canto superior") — CAUSA RAIZ: este `View` virou a caixa de
   * verdade de 44px de altura (antes essa altura morava direto no
   * `Pressable`); o único filho em fluxo normal dela é
   * `whatToWatchButtonContent` (ícone+texto — os outros 3 são
   * `position: "absolute"`, não contam pro layout). Sem
   * `alignItems`/`justifyContent` aqui, o React Native usa o padrão do
   * Flexbox (`flex-start` nos dois eixos) — o conteúdo, menor que
   * 44px, encostava no TOPO em vez de centralizar, sobrando espaço
   * embaixo. `Button.tsx` (`styles.base`) já faz exatamente isso
   * (`alignItems: "center", justifyContent: "center"`) pro mesmo
   * papel — replicado aqui.
   */
  whatToWatchInner: {
    // CRESCIDO (2026-10-16, a pedido) — 44 → 48, acompanha o ícone/
    // texto maiores (ver `whatToWatchButtonText`/`Feather` no JSX) e
    // `WHAT_TO_WATCH_BUTTON_CLEARANCE` (topo do arquivo).
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderTopColor: gelBlue.border.top,
    borderBottomColor: gelBlue.border.bottom,
    borderLeftColor: gelBlue.border.left,
    borderRightColor: gelBlue.border.right,
  },
  /** Mesma técnica/mesmo motivo de `gelInsetShineTop` (`Glass.tsx`) — linha de 1px pro brilho de cima do gel. */
  whatToWatchInsetShineTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  /** Mesma técnica/mesmo motivo de `gelInsetShineBottom` (`Glass.tsx`) — sombra suave embaixo, cor `gelBlue.insetBottom` (desvanecendo até transparente, aplicada via `LinearGradient` no JSX). */
  whatToWatchInsetShineBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 11,
  },
  /**
   * Row de verdade (ícone + texto lado a lado) — ver comentário no
   * JSX acima sobre a causa raiz de precisar deste `View` próprio.
   *
   * CAUSA RAIZ (2026-10-16, a pedido — "o botão veio vazio") — este é
   * o PRIMEIRO uso de `PressableScale` sem largura própria fixa (só
   * `height`, a largura vem do CONTEÚDO) — `PressableScale` embrulha
   * o filho num `Animated.View` com `alignSelf: "stretch"` (ver
   * comentário histórico em `PressableScale.tsx`, mesmo bug já
   * corrigido em `Button.tsx` em 2026-10-09). Pra essa cadeia
   * "stretch" funcionar, ALGUÉM no caminho precisa dar um tamanho
   * intrínseco (baseado em conteúdo) — e o `flex: 1` aqui fazia
   * exatamente o oposto: dizia "preencha o que o pai já tem", mas o
   * pai (o próprio `PressableScale`) só tem tamanho se ESTE `View`
   * disser. Resultado: ninguém no caminho tem tamanho real → o botão
   * colapsa (só a borda/anel de pulso, que são posicionados
   * separadamente, ficavam visíveis). Removido o `flex: 1` — sem ele,
   * o tamanho vem do conteúdo real (ícone + texto), que é exatamente
   * o que a pílula precisa pra se autodimensionar.
   */
  whatToWatchButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  /**
   * CRESCIDO (2026-10-16, a pedido — "quero que cresça mais o tamanho
   * da informação") — `fontSize.sm` (14) → `fontSize.md` (16).
   *
   * `lineHeight: 18` TRAVADO — mesma causa raiz já documentada (e já
   * resolvida pra Android) no componente `Text` (`components/ui/
   * Text.tsx`, `includeFontPadding: false`) e em `profile.tsx`: sem um
   * `lineHeight` travado, a caixa de linha vem das métricas BRUTAS da
   * fonte, que distribuem mais folga ABAIXO da letra do que acima —
   * mesmo com o `View` pai perfeitamente centralizado (ver
   * `whatToWatchInner` acima), o TEXTO em si ficava com essa folga
   * extra embaixo, lido como "ainda meio pra baixo". `18` é a mesma
   * proporção já usada noutro texto pequeno do app (bio do perfil,
   * `lineHeight: 20` pra `fontSize: 14`).
   */
  whatToWatchButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSize.md,
    lineHeight: 18,
  },
});
