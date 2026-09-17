import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useUpcomingEpisodes } from "@/lib/useUpcomingEpisodes";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { useDiscoverList } from "@/lib/useDiscoverList";
import { recalculateUpToDateSeriesCategoriesThrottled, prefetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchNextEpisodesToWatch, type NextEpisodeToWatch } from "@/lib/nextEpisodeToWatch";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { Screen, Text, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { SectionTitle } from "@/components/media/SectionTitle";
import { ViewAllButton } from "@/components/media/ViewAllButton";
import { ContinueWatchingListRow, ESPACO_ENTRE_CARDS } from "@/components/media/ContinueWatchingListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { EmptyLibraryHero } from "@/components/media/EmptyLibraryHero";
import { DiscoverCarousel } from "@/components/explore/DiscoverCarousel";
import { PageError } from "@/components/media/PageError";
import { UpcomingEpisodeCard } from "@/components/media/UpcomingEpisodeCard";
import { UpcomingEpisodeCardSkeleton } from "@/components/media/UpcomingEpisodeCardSkeleton";
import { LibraryGridSkeleton } from "@/components/media/LibraryGridSkeleton";
import { LibraryListSkeleton } from "@/components/media/LibraryListSkeleton";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { HOME_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { translateDayLabel } from "@/lib/i18n/dayLabels";
import { colors, spacing, radius } from "@/lib/theme";
// DIAGNÓSTICO TEMPORÁRIO (2026-09-17) — ver `lib/perfNavStamp.ts`. REMOVER junto.
import { logTempoDesdeOToque } from "@/lib/perfNavStamp";

const CONTINUE_LIMIT = 8;

/**
 * A PEDIDO — seção "Faz um tempo que você não assiste". Série que
 * está em "Assistindo" mas sem NENHUM episódio marcado há 2 semanas
 * desce automaticamente de "Continue assistindo" pra essa seção
 * separada, mais abaixo.
 *
 * Usa `lastActivityAt` (não `updatedAt`): esse campo já reflete o
 * episódio mais recente REALMENTE assistido, não só a última vez que
 * o status mudou — é o que faz "faz um tempo que você não assiste"
 * significar o que promete. Sem botão nenhum e sem tela própria (a
 * pedido) — a seção só aparece quando tem algo nela, e some sozinha
 * quando a pessoa volta a assistir.
 */
const STALE_AFTER_DAYS = 14;

/**
 * TASK-091 — primeira tela de conteúdo real do app nativo (depois da
 * fundação). Porta o essencial de `SeriesHome.tsx` +
 * `MinhaListaSection.tsx` do web: sub-abas (agora via `HomeTabs`
 * compartilhado, TASK-092), "Continue assistindo" (status "watching",
 * os 8 mais recentes) com pôster/progresso de verdade vindos do
 * Supabase, e os 3 atalhos que no web abrem telas dedicadas (aqui,
 * telas empilhadas dentro da própria aba — ver `_layout.tsx`).
 *
 * Fora do escopo desta leva, de propósito, na época: a sub-aba "Em
 * breve" (TASK-119, já construída depois) e a tela de detalhes da
 * série (também já construída depois).
 */
export default function SeriesHomeScreen() {
  // DIAGNÓSTICO TEMPORÁRIO (2026-09-17) — roda em TODO render (não só no 1º), pra ver se a tela está remontando a cada troca de aba. REMOVER junto.
  console.log(`[PERF-DOCK] BODY Séries (Minha Lista) renderizou em ${performance.now().toFixed(1)}ms`);
  const router = useRouter();
  const tabBarClearance = useTabBarClearance();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  // DIAGNÓSTICO TEMPORÁRIO (2026-09-17) — ver `lib/perfNavStamp.ts`. REMOVER junto.
  useFocusEffect(useCallback(() => { logTempoDesdeOToque("Séries (Minha Lista)"); }, []));
  /**
   * CORREÇÃO DE RAIZ (2026-09-17, reportado — "mudar de tabs ainda
   * trava", igual ao mesmo bug já corrigido em `series/[id].tsx`
   * nesta mesma sessão) — o `tab === "minha-lista" ? (<ScrollView>) :
   * (<ScrollView>)` mais abaixo DESMONTAVA a árvore inteira da aba que
   * saía de vista e MONTAVA do zero a que entrava, a cada troca —
   * caro pra "Minha Lista" (grade/lista de séries, cards com pôster) e
   * pra "Em breve" (trilha + cards de episódio). Mesmo padrão da
   * correção irmã: cada aba monta UMA vez (na primeira vez que é
   * aberta) e depois só alterna visibilidade via `display: none`
   * (`styles.hidden`) — nunca mais desmonta content já carregado.
   * "Minha Lista" já nasce montada (é a aba inicial); "Em breve" só
   * monta quando o usuário abre ela pela primeira vez.
   */
  const [jaMontouMinhaLista, setJaMontouMinhaLista] = useState(true);
  const [jaMontouEmBreve, setJaMontouEmBreve] = useState(false);
  useEffect(() => {
    if (tab === "minha-lista") setJaMontouMinhaLista(true);
    else setJaMontouEmBreve(true);
  }, [tab]);
  /**
   * ACHADO DE PERFORMANCE (a pedido — "Séries busca a biblioteca 2x
   * toda abertura", confirmado com `adb logcat` em aparelho real) —
   * `skipInitialLoad`/`skipFocusRefetch` desligam a busca automática
   * própria do hook: o `useFocusEffect` logo abaixo (que já existia,
   * pra recalcular categorias ANTES de rebuscar) passa a ser o ÚNICO
   * disparador de busca desta tela, em vez de competir com uma
   * segunda busca automática do hook rodando por baixo. Ver comentário
   * completo em `lib/useLibraryItems.ts`.
   */
  const { items, isLoading, isError, refreshing, refetch, refetchSilently } = useLibraryItems({
    skipInitialLoad: true,
    skipFocusRefetch: true,
  });

  const upcoming = useUpcomingEpisodes();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("series-library");
  const { t, locale } = useTranslation();
  /**
   * PORTE DO WEB (2026-09-03, auditoria "implementar tudo que não
   * envolve redesign" — item "empty state") — `MinhaListaSection.tsx`
   * do web mostra a fileira "Populares no SeenList" (`PopularMediaRow`,
   * `trending_series`) embaixo do card vazio quando "Continue
   * assistindo" está zerado. Aqui reaproveita 100% do que já existe
   * (mesmo `DiscoverCarousel`/`useDiscoverList` do Explorar — nenhum
   * componente novo), só sem a ilustração/`EmptyLibraryHero` (isso é
   * visual/redesign, fora do escopo desta leva).
   */
  const trendingSeries = useDiscoverList("trending_series");

  /**
   * ESTABILIZADO (2026-09-17, réplica do fix do Perfil — "pode
   * replicar nas outras abas") — este título é passado como `title`
   * (um elemento JSX) pro `DiscoverCarousel`, agora memoizado
   * (`memo()`, ver `DiscoverCarousel.tsx`) — sem fixar a identidade
   * dele aqui com `useMemo`, um elemento NOVO seria criado a cada
   * render desta tela (o JSX inline sempre é um objeto novo), e o
   * `memo()` do carrossel nunca teria props "iguais" pra comparar.
   * Os dois lugares que usam essa fileira (biblioteca vazia / tudo em
   * dia) compartilham o mesmo título — um `useMemo` só, reaproveitado.
   */
  const popularSeriesTitle = useMemo<ReactNode>(
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

  /**
   * TASK-143/151 — toda vez que a aba Séries ganha foco, recalcula
   * sozinho se alguma série "Em dia" ganhou episódio novo desde a
   * última vez (sem precisar marcar nada manualmente) — depois busca
   * a biblioteca de novo, EM SILÊNCIO (`refetchSilently`, não
   * `refetch`) — usar `refetch` aqui ativava sem querer o spinner de
   * "puxar pra atualizar", mesmo sem ninguém ter puxado nada.
   *
   * PERFORMANCE (achado real, mesmo do web — "Home lenta") — usa a
   * versão com limite de 1x/dia (`...Throttled`, ver
   * `lib/seriesDetails.ts`) em vez da função crua: sem isso, essa
   * checagem pesada rodava do zero a CADA foco da aba, não só ao
   * montar.
   */
  useFocusEffect(
    useCallback(() => {
      recalculateUpToDateSeriesCategoriesThrottled()
        .then(() => refetchSilently())
        .catch((error) => console.error("[SeriesHomeScreen] Falha ao recalcular categorias em foco", error));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  /**
   * CORREÇÃO (bug real, reportado — "Tanya the Evil assistindo, mas
   * não aparece na Home") — "Em dia" (`up_to_date`) é um status
   * PRÓPRIO, separado de "watching". Filtrando só "watching" aqui,
   * uma série que passou a "Em dia" (episódios em dia com o que já
   * saiu) sumia de "Continue assistindo" até `recalculateUpToDate-
   * SeriesCategories` (chamado ao focar a aba) promovê-la de volta
   * pra "watching" quando saísse episódio novo — nesse meio tempo,
   * se a série tivesse QUALQUER pendência real (ex.: episódio
   * lançado mas ainda não processado pelo recálculo), ela ficava
   * invisível na Home mesmo aparecendo em "Assistindo" no Perfil
   * (que lista por status puro, sem essa lacuna). Mesma correção já
   * aplicada no web (`MinhaListaSection.tsx`).
   *
   * CORREÇÃO #2 (2026-09-03 — auditoria "implementar tudo que não
   * envolve redesign", achado real: o modo GRADE nunca recebeu esta
   * mesma correção) — até aqui, só o modo LISTA incluía "Em dia" com
   * pendência real; o modo GRADE continuava filtrando só "watching",
   * excluindo TODA série "Em dia" de propósito (mesmo bug que o web
   * já teve e corrigiu — "Bleach aparece na lista e não na grade",
   * ver `ContinueWatchingPosterGrid.tsx`/`UpToDateGate` no web). Como
   * o mobile já busca o "próximo episódio pendente" de cada série
   * pra montar o card completo da lista (`fetchNextEpisodesToWatch`,
   * abaixo), a correção mais simples e sem duplicar a regra é usar
   * ESSE MESMO resultado como o "portão": os dois modos agora
   * compartilham a mesma seleção (`continueWatching`, uma lista só,
   * nunca mais duas calculadas em separado) e a grade só exibe uma
   * série "Em dia" quando ela também aparece no mapa de próximos
   * episódios pendentes — exatamente a mesma checagem que o card da
   * lista já fazia pra decidir se mostra ou não.
   */
  /**
   * A PEDIDO — "Faz um tempo que você não assiste": corte por
   * `lastActivityAt` (episódio realmente assistido), 14 dias. Feito
   * ANTES das listas de "Continue assistindo" porque as duas
   * precisam desse mesmo corte pra não mostrar a mesma série nas
   * duas seções.
   */
  const { recentSeries, staleSeries } = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const allSeries = (items ?? []).filter((item) => item.mediaType === "series");
    const recent: LibraryItem[] = [];
    const stale: LibraryItem[] = [];

    for (const item of allSeries) {
      // Só "watching" pode ficar parada — "Em dia" não tem nada
      // pendente pra assistir, então não faz sentido cobrar.
      const isStale = item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff;
      (isStale ? stale : recent).push(item);
    }

    stale.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return { recentSeries: recent, staleSeries: stale };
  }, [items]);

  /**
   * CORREÇÃO (bug real, reportado com print — Tomb Raider King,
   * "De Caipira a Mestre Espadachim" etc. aparecendo na grade mas
   * sumindo no modo lista) — mesmo bug já corrigido no web antes
   * (comentário lá cita os mesmos exemplos: "Tanya the Evil, Daemons
   * do Reino das Sombras e Rick and Morty"), nunca portado pra essa
   * segunda parte da correção no mobile. O filtro já incluía "Em
   * dia" aqui, mas a ORDENAÇÃO continuava numa camada só (só por
   * `updatedAt`) — uma série "Em dia" mexida recentemente (sem
   * episódio pendente pra assistir agora) competia pelas mesmas 8
   * vagas com uma série "Assistindo" de verdade (que TEM episódio
   * pendente), podendo empurrar essa pra fora do corte. Ordenação em
   * duas camadas, igual ao web: primeiro por status (watching
   * sempre antes de up_to_date), dentro de cada grupo por
   * `updatedAt` — uma série com episódio pendente de verdade nunca
   * mais perde vaga pra uma que talvez nem tenha nada pra mostrar.
   */
  const continueWatching = useMemo(() => {
    return recentSeries
      .filter((item) => item.status === "watching" || item.status === "up_to_date")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      })
      .slice(0, CONTINUE_LIMIT);
  }, [recentSeries]);

  /**
   * TASK-145 — busca o "próximo episódio pendente" de cada série de
   * "Continue assistindo"/"Faz um tempo que você não assiste". Usado
   * pelo modo LISTA pra montar o card completo, e (2026-09-03) também
   * pelo modo GRADE, como "portão" pra decidir se uma série "Em dia"
   * tem pendência real — ver comentário grande acima de
   * `continueWatching`.
   */
  const [nextEpisodes, setNextEpisodes] = useState<Map<number, NextEpisodeToWatch>>(new Map());
  /**
   * TASK-176 (achado real, a pedido — "mostra o cartão antigo por
   * uns segundos, depois troca pro novo") — sem isso, não dava pra
   * distinguir "ainda buscando o próximo episódio" de "buscou e essa
   * série genuinamente não tem nenhum pendente" — os dois casos
   * pareciam a mesma coisa (`nextEpisodes.get(item.id)` undefined),
   * então a lista caía no cartão simples (`MediaListRow`) por engano
   * enquanto os dados certos ainda estavam a caminho, e só trocava
   * pro cartão completo (`ContinueWatchingListRow`) quando a busca
   * terminava — visível como uma "atualização" incômoda.
   */
  const [nextEpisodesLoaded, setNextEpisodesLoaded] = useState(false);

  /**
   * CORREÇÃO (2026-09-04, reportado — "marcou, fez a animação de
   * assistido, mas não fez a animação deslizando sutil pra cima") —
   * espelha `layoutActive`/`onTransitionActiveChange` de
   * `MinhaListaSection.tsx` (web): o `layout` do Reanimated (ver
   * `ContinueWatchingListRow.tsx`) precisa ficar ligado nas linhas
   * IRMÃS enquanto QUALQUER uma delas está de fato animando (confirmando
   * ou saindo), pra elas reposicionarem suavemente quando uma sai da
   * lista — e desligado no resto do tempo (mesmo raciocínio do web:
   * deixar ligado sempre, parado, seria trabalho à toa nas duas listas
   * inteiras só "de prontidão"). Contador, não booleano simples — mais
   * de uma linha pode estar animando ao mesmo tempo (nada impede tocar
   * em duas séries diferentes em sequência rápida).
   */
  const [activeTransitionCount, setActiveTransitionCount] = useState(0);
  const handleTransitionActiveChange = useCallback((active: boolean) => {
    setActiveTransitionCount((count) => Math.max(0, count + (active ? 1 : -1)));
  }, []);
  const layoutActive = activeTransitionCount > 0;

  /**
   * A PEDIDO — a seção "Faz um tempo que você não assiste" usa o
   * MESMO card completo do "Continue assistindo"
   * (`ContinueWatchingListRow`: código do episódio, selo NOVO/MAIS
   * RECENTE, botão de check rápido) — antes usava um card simples
   * só com progresso, visualmente inconsistente com o resto da tela.
   * Por isso a busca de "próximo episódio pendente" precisa cobrir
   * as duas listas, não só a de cima.
   *
   * CORREÇÃO (2026-09-03, ver comentário grande acima de
   * `continueWatching`) — antes só buscava no modo LISTA
   * (`viewMode === "list" ? ... : []`); agora busca SEMPRE, porque o
   * modo GRADE também depende deste mesmo resultado pra decidir se
   * uma série "Em dia" tem pendência real (o "portão").
   */
  const listNeedingEpisodes = useMemo(() => [...continueWatching, ...staleSeries], [continueWatching, staleSeries]);

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-04 — "tudo em dia mostra espaço em
   * branco", auditoria web-vs-mobile) — mesmo raciocínio de
   * `visibleContinueWatching` do web (`MinhaListaSection.tsx`): a
   * checagem `continueWatching.length === 0` logo abaixo só olha o
   * STATUS bruto ("watching"/"up_to_date"), não se existe pendência de
   * verdade. Sem este cálculo centralizado, cada série "Em dia" sem
   * episódio pendente real (`nextEpisodes` não tem entrada pra ela)
   * passava pelo primeiro filtro (achava que tinha conteúdo) e só
   * desaparecia DEPOIS, dentro do modo grade (`PosterGrid`, filtro
   * inline) ou dentro de cada `ContinueWatchingListRow` (que retorna
   * `null` sozinho) — se TODAS as séries caíssem nesse caso ao mesmo
   * tempo, a seção inteira ficava sem nenhum card E sem nenhuma
   * mensagem, só espaço em branco. Calculado uma vez só, reaproveitado
   * pela checagem de vazio de verdade e pelo modo grade.
   */
  const visibleContinueWatching = useMemo(
    () => continueWatching.filter((item) => item.status === "watching" || nextEpisodes.has(item.id)),
    [continueWatching, nextEpisodes]
  );

  /**
   * CAUSA RAIZ do "a tela atualiza em vez da animação" (2026-09-09,
   * achada nos 28 quadros do vídeo: entre marcar e a lista voltar,
   * TODOS os cards viram caixas vazias por ~1 segundo).
   *
   * Não era a animação — era o esqueleto. Marcar um episódio chama
   * `loadNextEpisodes()`, que zerava `nextEpisodesLoaded`; e a tela
   * troca a lista INTEIRA por `<LibraryListSkeleton />` enquanto ele
   * for falso. Ou seja: toda remarcação recarregava a tela na cara do
   * usuário, e qualquer animação de layout ficava invisível debaixo
   * disso.
   *
   * O web não tem isso porque lá o refetch mantém os dados anteriores
   * na tela enquanto busca (React Query) — o esqueleto só aparece
   * quando não há NADA pra mostrar.
   *
   * Mesma regra aqui: o esqueleto é só da PRIMEIRA carga. Depois dela,
   * as buscas seguintes acontecem em silêncio, com a lista atual no
   * lugar — que é o que deixa o colapso do card e o deslize dos de
   * baixo aparecerem.
   */
  const jaCarregouEpisodiosRef = useRef(false);

  const loadNextEpisodes = useCallback(() => {
    if (listNeedingEpisodes.length === 0) return;
    if (!jaCarregouEpisodiosRef.current) setNextEpisodesLoaded(false);
    fetchNextEpisodesToWatch(listNeedingEpisodes.map((item) => item.id), locale)
      .then((map) => {
        setNextEpisodes(map);
        jaCarregouEpisodiosRef.current = true;
        setNextEpisodesLoaded(true);
      })
      .catch((error) => {
        console.error("[SeriesHomeScreen] Falha ao buscar próximos episódios", error);
        jaCarregouEpisodiosRef.current = true;
        setNextEpisodesLoaded(true); // não trava no esqueleto pra sempre se der erro — cai pro cartão simples
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listNeedingEpisodes.map((i) => i.id).join(","), locale]);

  useEffect(loadNextEpisodes, [loadNextEpisodes]);

  /**
   * ESTABILIZADO (2026-09-17, réplica do fix do Perfil — "pode
   * replicar nas outras abas") — antes, cada `ContinueWatchingListRow`
   * (agora `memo()`, ver o componente) recebia uma função-seta NOVA
   * pra `onMarkedWatched` a cada render desta tela (`() => {
   * refetchSilently(); loadNextEpisodes(); }`, recriada dentro do
   * `.map()`) — isso sozinho já quebraria o `memo()` de todo card,
   * sempre. Como nenhum card precisa da sua PRÓPRIA identidade aqui
   * (é sempre a mesma ação: rebuscar biblioteca + próximos episódios),
   * um `useCallback` só, reaproveitado por todos, resolve — estável de
   * verdade agora que `refetchSilently` também é (correção de causa
   * raiz em `lib/useLibraryItems.ts`, mesma sessão).
   */
  const handleMarkedWatched = useCallback(() => {
    refetchSilently();
    loadNextEpisodes();
  }, [refetchSilently, loadNextEpisodes]);

  /**
   * A PEDIDO (auditoria — velocidade percebida) — pré-carrega, em
   * silêncio, o detalhe das 2 primeiras séries de "Continue
   * assistindo": são de longe as mais prováveis de serem tocadas, e
   * assim a tela abre sem espera nenhuma. Não é trabalho extra de
   * verdade — é a MESMA busca que aconteceria ao tocar, só
   * antecipada; se falhar, a tela busca normalmente depois.
   */
  useEffect(() => {
    for (const item of continueWatching.slice(0, 2)) {
      prefetchSeriesDetails(String(item.id), locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueWatching.map((i) => i.id).join(",")]);

  /*
   * CORREÇÃO (2026-09-10, reportado — "continue assistindo/switch de
   * grid e lista estão aparecendo na emptystate") — no web
   * (`MinhaListaSection.tsx`), o cabeçalho (título "Continue
   * assistindo" + alternância grade/lista) fica dentro de `{!isEmptyState
   * && (...)}` — ou seja, SOME nos dois estados vazios (nunca
   * adicionou nada, ou tudo em dia), porque o `EmptyLibraryHero` já
   * tem seu próprio título grande. Aqui o cabeçalho sempre renderizava,
   * incondicional, então aparecia flutuando sozinho em cima da
   * ilustração. `isEmptyState` cobre os DOIS branches vazios daqui
   * (`continueWatching.length === 0` e, depois de confirmado via
   * `nextEpisodesLoaded`, `visibleContinueWatching.length === 0`) —
   * web não precisa dessa separação em dois porque não tem o mesmo
   * `nextEpisodesLoaded` (o filtro de "tem pendência real" já vem
   * pronto de outra fonte lá).
   */
  const isEmptyState =
    viewModeReady &&
    !isLoading &&
    (continueWatching.length === 0 || (nextEpisodesLoaded && visibleContinueWatching.length === 0));

  /**
   * ESTABILIZADO (2026-09-17, réplica do fix do Perfil — "pode
   * replicar nas outras abas") — era declarada como `function` normal
   * dentro do corpo do componente: identidade nova a cada render,
   * quebrando o `memo()` de `PosterGrid`/`PosterGridItem` (ver
   * `PosterGrid.tsx`) do mesmo jeito que as funções-seta inline
   * quebravam o de `ContinueWatchingListRow`.
   */
  const handlePressItem = useCallback(
    (item: LibraryItem) => {
      router.push(`/series/${item.id}`);
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
      {/*
        TESTE REVERTIDO (2026-09-16 — "vamos fazer um teste, substitui o
        fundo atual por essa imagem" / depois "testado, pode reverter").
        Trocou-se `background` por uma `<Image>` estática pré-renderizada
        (`ambient-test-glow.png`), tentando fugir do banding do fundo
        computado. Testado no aparelho e revertido — de volta ao
        `AmbientGlow`/`HOME_GLOW_BLOBS` original. O banding nas manchas
        azuis continua um problema EM ABERTO (ver opções já levantadas em
        `Glass.tsx`, perto de `DITHER_OPACITY`: baixar o brilho de volta
        pro patamar já resolvido, aceitar o banding como trade-off, ou
        regerar os PNGs de `GLOW_DISCS` com gradiente mais suave).
      */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={HOME_GLOW_BLOBS} />}>
      <View style={styles.tabsRow}>
        <HomeTabs active={tab} onChange={setTab} />
      </View>

      {jaMontouMinhaLista && (
        <ScrollView
          style={tab === "minha-lista" ? undefined : styles.hidden}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {!isError && !isEmptyState && (
            <View style={styles.sectionHeader}>
              <SectionTitle>{t("seriesHome.continueWatching")}</SectionTitle>
              <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            </View>
          )}

          {isError ? (
            <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />
          ) : !viewModeReady ? (
            // CORREÇÃO (2026-09-04, "esqueleto no formato errado por um
            // instante" — ver comentário de `useViewModePreference.ts`)
            // — enquanto o formato grade/lista de verdade ainda não foi
            // conferido no `AsyncStorage`, não desenha nenhum esqueleto
            // — evita mostrar "grade" (suposição) e trocar de formato
            // na frente da pessoa assim que o valor real (ex.: "lista")
            // chegar.
            null
          ) : isLoading ? (
            viewMode === "grid" ? (
              <LibraryGridSkeleton />
            ) : (
              <LibraryListSkeleton />
            )
          ) : continueWatching.length === 0 ? (
            /*
              PORTE DO WEB (2026-09-10, auditoria — vazio "de verdade",
              nunca adicionou nada) — o web usa `EmptyLibraryHero`
              (ilustração + título + subtítulo + botão + divisor "OU"),
              solto direto em cima do fundo — não o `EmptyShelf` (card
              com borda tracejada). Ver `EmptyLibraryHero.tsx`.
            */
            <>
              <EmptyLibraryHero
                title={t("seriesHome.emptyLibraryTitle")}
                subtitle={t("seriesHome.emptyLibrarySubtitle")}
                actionLabel={t("seriesHome.exploreSeries")}
                actionHref="/(tabs)/explore"
                dividerLabel={t("seriesHome.or")}
              />
              {/*
                * `DiscoverCarousel` já tem seu próprio `paddingHorizontal:
                * spacing.md` interno (mesmo componente usado "cru", sem
                * container extra, no Explorar — ver `explore.tsx`,
                * `discoverContent` não tem padding horizontal nenhum,
                * de propósito). Esta tela, diferente do Explorar, já
                * envolve tudo num `ScrollView` com `styles.content`
                * (`paddingHorizontal: spacing.md`) — sem a margem
                * negativa abaixo, o carrossel ficaria com o dobro de
                * respiro nas bordas, desalinhado do card vazio acima.
                *
                * CORREÇÃO (2026-09-03, decisão do usuário: padronizar
                * borda de tela em 16px app-wide) — os três valores
                * citados acima eram `spacing.lg` (24); atualizados
                * juntos pra `spacing.md` (16), mantendo o alinhamento
                * entre eles.
                */}
              <View style={styles.popularSection}>
                <DiscoverCarousel
                  title={popularSeriesTitle}
                  items={trendingSeries.items}
                  isLoading={trendingSeries.isLoading}
                  viewAllHref="/explore/all/trending_series"
                />
              </View>
            </>
          ) : !nextEpisodesLoaded ? (
            viewMode === "grid" ? <LibraryGridSkeleton /> : <LibraryListSkeleton />
          ) : visibleContinueWatching.length === 0 ? (
            /*
             * CORREÇÃO DE CAUSA RAIZ (2026-09-04 — "tudo em dia mostra
             * espaço em branco", auditoria web-vs-mobile — ver
             * comentário grande em `visibleContinueWatching` acima e
             * "Estado vazio melhorado" em `MinhaListaSection.tsx` do
             * web) — chega até aqui só depois de confirmar (via
             * `nextEpisodesLoaded`) que NENHUMA série de
             * `continueWatching` tem pendência real agora — ou seja, a
             * pessoa JÁ tem séries na Biblioteca (passou pelo branco
             * acima), só que está tudo em dia neste momento. Antes,
             * sem este branch, a tela caía direto no modo grade/lista,
             * que filtravam/retornavam `null` sozinhos pra CADA item —
             * se todos caíssem nesse caso ao mesmo tempo, sobrava
             * espaço em branco sem nenhum aviso.
             */
            /*
              CORREÇÃO (2026-09-10, mesma auditoria do `EmptyLibraryHero`
              acima) — no web, "tudo em dia" É O MESMO branch de "nunca
              adicionou nada" (`visibleContinueWatching.length === 0`
              lá), só troca o texto — os dois casos SEMPRE mostram
              `EmptyLibraryHero` + a fileira "Populares" embaixo. Aqui
              os dois casos são branches separados (por causa do
              `nextEpisodesLoaded`, ver comentário acima), mas o
              resultado visual precisa ser o mesmo: faltava a fileira
              "Populares" inteira neste branch.
            */
            <>
              <EmptyLibraryHero
                title={t("seriesHome.emptyCaughtUpTitle")}
                subtitle={t("seriesHome.emptyCaughtUpSubtitle")}
                actionLabel={t("seriesHome.exploreSeries")}
                actionHref="/(tabs)/explore"
                dividerLabel={t("seriesHome.or")}
              />
              <View style={styles.popularSection}>
                <DiscoverCarousel
                  title={popularSeriesTitle}
                  items={trendingSeries.items}
                  isLoading={trendingSeries.isLoading}
                  viewAllHref="/explore/all/trending_series"
                />
              </View>
            </>
          ) : viewMode === "grid" ? (
            <PosterGrid items={visibleContinueWatching} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {continueWatching.map((item, indice) => {
                /**
                 * CORREÇÃO (bug real, reportado com print — "série já
                 * em dia ainda na Home", card com formato errado) —
                 * `nextEpisodes.get(item.id)` vem `undefined` tanto pra
                 * "ainda buscando" (tratado acima, via
                 * `nextEpisodesLoaded`) quanto pra "já buscou e essa
                 * série genuinamente não tem episódio pendente com
                 * data já passada" — ou seja, ela está em dia hoje, só
                 * o status no banco ainda não foi recalculado (o
                 * recálculo agora roda só 1x/dia).
                 *
                 * CORREÇÃO (2026-09-04, achado ao implementar a
                 * animação de "marcar assistido" — ver
                 * ContinueWatchingListRow.tsx) — antes, o `if
                 * (!nextEpisode) return null` ficava AQUI, no pai: assim
                 * que `loadNextEpisodes()` (disparado pelo próprio
                 * toque no ✓) trazia um mapa sem mais entrada pra esta
                 * série, o React desmontava o card NA HORA, cortando a
                 * animação de saída no meio (sem tempo de mostrar a
                 * confirmação nem o card encolhendo). Agora o pai
                 * SEMPRE renderiza `ContinueWatchingListRow` pra toda
                 * série de `continueWatching` (ela só sai desta lista
                 * quando o status muda de verdade, não por causa de um
                 * episódio específico) — é o PRÓPRIO card quem decide
                 * quando não tem mais nada pra mostrar, exatamente
                 * como o web (`ContinueWatchingCard.tsx`: `if
                 * (next.length === 0 && phase === "idle") return
                 * null`), congelando o último episódio mostrado
                 * enquanto a animação de confirmação/saída ainda está
                 * rolando.
                 */
                return (
                  <ContinueWatchingListRow
                    key={item.id}
                    item={item}
                    /* A posição decide a força do destaque âmbar na lateral — mesma curva do web, ver `OPACIDADE_DESTAQUE` no componente. */
                    priorityIndex={indice}
                    nextEpisode={nextEpisodes.get(item.id) ?? null}
                    layoutActive={layoutActive}
                    onTransitionActiveChange={handleTransitionActiveChange}
                    onMarkedWatched={handleMarkedWatched}
                  />
                );
              })}
            </View>
          )}

          {/*
            PORTE DO WEB (2026-09-09, a pedido) — o botão "Ver tudo",
            que o web tem e aqui não existia. Condição e posição são as
            de lá (`MinhaListaSection.tsx`): só aparece quando há o que
            listar, e vem DEPOIS dos cards, tanto no modo grade quanto
            no de lista — o `viewMode` não muda onde ele entra.
          */}
          {visibleContinueWatching.length > 0 && (
            <ViewAllButton
              label={t("seriesHome.viewAllContinueWatching")}
              onPress={() => router.push("/series/continue-assistindo")}
            />
          )}

          {/*
            * A PEDIDO — "Ver todas da lista Assistir depois" removido
            * daqui. A lista continua acessível normalmente (a rota
            * `/(tabs)/series/watchlist` não foi apagada), só não
            * ocupa mais espaço fixo no fim da Home.
            */}

          {staleSeries.length > 0 && (
            <View style={styles.staleSection}>
              {/*
                Também é `SectionTitle` no web (`MinhaListaSection.tsx`,
                mesma pílula de "Continue assistindo") — aqui era um
                título comum. O texto continua literal nos dois lados:
                nem o web tem chave de tradução pra ele.
              */}
              <View style={styles.staleTitle}>
                <SectionTitle>Faz um tempo que você não assiste</SectionTitle>
              </View>
              {viewMode === "grid" ? (
                <PosterGrid items={staleSeries} onPressItem={handlePressItem} />
              ) : !nextEpisodesLoaded ? (
                <LibraryListSkeleton />
              ) : (
                <View style={styles.listRows}>
                  {staleSeries.map((item) => {
                    // Mesma regra do "Continue assistindo" acima (ver
                    // comentário grande lá, 2026-09-04) — o próprio
                    // `ContinueWatchingListRow` decide quando não tem
                    // nada pra mostrar, pra não cortar a animação de
                    // saída no meio.
                    return (
                      <ContinueWatchingListRow
                        key={item.id}
                        item={item}
                        nextEpisode={nextEpisodes.get(item.id) ?? null}
                        layoutActive={layoutActive}
                        onTransitionActiveChange={handleTransitionActiveChange}
                        onMarkedWatched={handleMarkedWatched}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
      {jaMontouEmBreve && (
        <ScrollView
          style={tab === "minha-lista" ? styles.hidden : undefined}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        >
          {upcoming.isLoading ? (
            <UpcomingEpisodeCardSkeleton />
          ) : upcoming.isError ? (
            <PageError message={t("seriesHome.errorLoadUpcoming")} onRetry={() => upcoming.refetch()} />
          ) : upcoming.groups.length === 0 ? (
            <EmptyShelf
              message={t("seriesHome.emptyUpcoming")}
              actionLabel={t("seriesHome.exploreSeries")}
              actionHref="/(tabs)/explore"
            />
          ) : (
            /**
             * CORREÇÃO (bug real, reportado — "'em breve' não está
             * igual a web", 2026-09-04) — faltava a trilha vertical
             * (ponto + linha) conectando os cards do MESMO grupo de
             * data, que `EmBreveSection.tsx` do web tem desde a
             * TASK-063 ("ajuda a ler 'isso é uma sequência de
             * próximos lançamentos', não N caixas soltas"). Estrutura
             * portada 1:1: cada linha é uma `View` `flexDirection:
             * "row"` com uma coluna de trilha (ponto + linha, largura
             * 12) ao lado da coluna de conteúdo (card + um "spacer"
             * quando não é o último do grupo) — o spacer fica DENTRO
             * da coluna de conteúdo (não como margem do lado de fora)
             * pra que a trilha (irmã, que estica pra cobrir a altura
             * do que está do lado dela por padrão do flexbox) cubra
             * esse espaço também e a linha fique contínua, ponto a
             * ponto — mesmo truque do web (ver comentário lá). Ponto
             * do PRIMEIRO episódio de cada grupo é âmbar
             * (`colors.primary`); os demais, cinza claro translúcido.
             */
            <View style={styles.groupList}>
              {upcoming.groups.map((group) => (
                <View key={group.dateKey}>
                  {/*
                    PORTE DO WEB (2026-09-09) — a pílula do dia era um
                    retângulo de `colors.surface`. No `EmBreveSection.tsx`
                    do web ela é, com o comentário dizendo isso lá,
                    "mesmo padrão de SectionTitle.tsx": a mesma pílula de
                    vidro do título de seção, e centralizada
                    (`flex justify-center`).
                  */}
                  <View style={styles.dayPillWrapper}>
                    <SectionTitle>{translateDayLabel(group.label, t)}</SectionTitle>
                  </View>
                  <View>
                    {group.episodes.map((episode, index) => {
                      const isFirstInGroup = index === 0;
                      const hasNextInGroup = index < group.episodes.length - 1;
                      return (
                        <View key={`${episode.seriesId}-${episode.seasonNumber}-${episode.episodeNumber}`} style={styles.timelineRow}>
                          <View style={styles.track}>
                            <View style={[styles.trackLineHalf, !isFirstInGroup && styles.trackLineHalfVisible]} />
                            <View style={[styles.trackDot, isFirstInGroup ? styles.trackDotFirst : styles.trackDotMuted]} />
                            <View style={[styles.trackLineHalf, hasNextInGroup && styles.trackLineHalfVisible]} />
                            {hasNextInGroup && <View style={styles.trackLine} />}
                          </View>
                          <View style={styles.timelineContent}>
                            <UpcomingEpisodeCard episode={episode} />
                            {hasNextInGroup && <View style={styles.timelineSpacer} />}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      </GlassTargetProvider>

    </Screen>
  );
}

const styles = StyleSheet.create({
  /** O provedor precisa ocupar a tela toda pras manchas cobrirem tudo — mesmo estilo de `explore.tsx`/`profile.tsx`. */
  glassFill: {
    flex: 1,
  },
  /** Ver comentário grande em `jaMontouMinhaLista`/`jaMontouEmBreve` — esconde sem desmontar, pra trocar de aba não remontar a árvore inteira. */
  hidden: {
    display: "none",
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
  /** `mb-3` = 12 no web (`MinhaListaSection.tsx`); estava `spacing.sm` = 8. */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  /**
   * SEM `gap` (2026-09-09): quem espaça é o `marginBottom` de cada card
   * (`ESPACO_ENTRE_CARDS`), como no web. Os dois juntos davam 16 de
   * respiro em vez de 12.
   *
   * O `marginBottom` negativo cancela o do ÚLTIMO card — é o
   * `last:mb-0` do web, que aqui não tem equivalente direto.
   */
  listRows: {
    marginBottom: -ESPACO_ENTRE_CARDS,
  },
  // CORREÇÃO (2026-09-03) — `marginHorizontal` era `-spacing.lg` pra
  // cancelar exatamente o `paddingHorizontal` do `content` (acima) —
  // ver comentário no JSX que usa este estilo. Atualizado junto.
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
  /** `mt-8` = 32 no web. */
  staleSection: {
    marginTop: 32,
  },
  /** `mt-3` = 12 entre título e conteúdo no web; estava `spacing.sm` = 8. */
  staleTitle: {
    marginBottom: 12,
  },
  groupList: {
    gap: spacing.lg,
  },
  // CORREÇÃO (fontes/espaçamento — mesma auditoria, conferido contra
  // `EmBreveSection.tsx` do web) — `mb-3`=12 (não `spacing.sm`=8),
  // `px-3.5`=14 (não `spacing.md`=16), `text-xs`=12 (não 11).
  dayPillWrapper: {
    alignItems: "center",
    marginBottom: 12,
  },
  // Trilha (ponto + linha) conectando os cards do mesmo grupo — ver
  // comentário grande acima, no JSX do modo "Em breve".
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  track: {
    width: 12,
    alignItems: "center",
  },
  /**
   * CORREÇÃO DE RAIZ (2026-09-15, bug real reportado com print — "a
   * bolinha... deixa ela mais no centro do card, atualmente ela é mais
   * pra cima", nos dois lados, web incluso — ver mesma correção em
   * `EmBreveSection.tsx` do web) — a trilha (`track`) inteira estica
   * pra cobrir a altura do card + o `timelineSpacer` (via
   * `alignItems: "stretch"`, padrão da `timelineRow`, que ela precisa
   * pra desenhar a linha até o PRÓXIMO ponto). Antes, o ponto
   * (`trackDot`) era o primeiro filho dessa coluna esticada, sem
   * nenhum `justifyContent` — sentava direto no TOPO da trilha inteira
   * (card + spacer), não no centro do card.
   *
   * TENTATIVA 1 (revertida) — isolar o ponto num `flex: 1` só, com a
   * linha de conexão numa altura fixa: centralizava certo, mas
   * "cortava" a linha, que passou a cobrir só o `timelineSpacer` (10px)
   * — faltava o trecho entre o ponto (no meio do card) e o FIM do
   * card, deixando um vão visível entre um ponto e o próximo (bug
   * reportado com print, "a linha que liga um ponto ao outro ficou
   * bugada").
   *
   * SOLUÇÃO DE VERDADE — a trilha ganha DOIS espaçadores `flex: 1`
   * iguais, um ANTES e um DEPOIS do ponto (`trackLineHalf`), cada um
   * cobrindo METADE da altura "livre" (altura do card menos os 8px do
   * ponto) — como os dois são iguais, o ponto cai exatamente no centro
   * do card, não importa a altura dele. Cada metade some (some só a
   * COR, o espaço continua reservado) quando não tem nada a conectar
   * daquele lado (`!isFirstInGroup` pro de cima, `hasNextInGroup` pro
   * de baixo) — assim a linha fica visualmente contínua do centro de
   * um ponto ao centro do próximo: metade de baixo deste ponto + a
   * `trackLine` fixa (10, o mesmo `timelineSpacer`) + metade de cima
   * do próximo ponto, sem nenhum vão.
   */
  trackLineHalf: {
    width: 1,
    flex: 1,
  },
  trackLineHalfVisible: {
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  trackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackDotFirst: {
    backgroundColor: colors.primary,
  },
  trackDotMuted: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  /** Trecho fixo entre o fim de um card e o começo do próximo — mesma altura do `timelineSpacer` (10). Ver comentário grande em `trackLineHalf`, acima. */
  trackLine: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  timelineContent: {
    flex: 1,
    minWidth: 0,
  },
  timelineSpacer: {
    height: 10,
  },
});
