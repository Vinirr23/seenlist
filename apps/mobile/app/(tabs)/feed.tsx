import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, FlatList, RefreshControl, Pressable, StyleSheet, type ListRenderItem } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { useFeedEntries, fetchFollowedIds, type FeedEntry } from "@/lib/useFeedEntries";
import { ACTIVITY_WINDOW_DAYS, SERIES_ACTIVITY_STATUSES, MOVIE_ACTIVITY_STATUSES } from "@/lib/activityFeed";
import type { FeedScope } from "@/lib/posts";
import { PostCard } from "@/components/feed/PostCard";
import { ActivityCard } from "@/components/feed/ActivityCard";
import { ActivityGroupCard } from "@/components/feed/ActivityGroupCard";
import { FeedTrendingModule } from "@/components/feed/FeedTrendingModule";
import { FeedFriendsWatchingModule } from "@/components/feed/FeedFriendsWatchingModule";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { FeedItemEnter } from "@/components/feed/FeedItemEnter";
import { CreatePostButton } from "@/components/feed/CreatePostButton";
import { fetchLikeInfoFor, fetchCommentCountsFor } from "@/lib/social/likes";
import { fetchPollDataFor, type PollData } from "@/lib/social/polls";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { colors, spacing, radius, elevation, fontSize } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-095/153 — Feed nativo: lista de posts reais do Supabase, curtida
 * de verdade, contagem de comentários real, Realtime (curtidas/
 * comentários/enquetes/posts novos/atividade automática nova — ver
 * `hasNewFeedItems`, abaixo).
 *
 * HISTÓRICO DE NAVEGAÇÃO (raiz de um bug real corrigido em 2026-09-29,
 * "Cannot find module '@/components/explore/FeedTabContent'"):
 *   1. Feed nasceu como esta rota própria, com aba no dock.
 *   2. 2026-08-22 — descontinuado da barra (dado real: 20 follows/383
 *      usuários, 3 posts/7 dias, 0,0 posts-comentários por usuário
 *      ativo, maior fonte de bug do app) — rota ficou de pé, só sem
 *      link (`href: null`).
 *   3. 2026-09-28 — religado como SUB-ABA de Explorar: o conteúdo desta
 *      tela foi EXTRAÍDO pra `components/explore/FeedTabContent.tsx`
 *      (componente sem `<Screen>` próprio) e esta rota virou um wrapper
 *      fininho (`<Screen><FeedTabContent /></Screen>`) só pra manter
 *      `/feed` funcionando como fallback.
 *   4. 2026-09-29 (a pedido — "tirar feed de explorar e colocar na
 *      barra de navegação msm") — Feed volta a ser aba própria no dock
 *      (`components/layout/DockNavegacao.tsx`), sub-aba em Explorar
 *      removida. `FeedTabContent.tsx` ficou sem NENHUM outro uso
 *      depois disso (só existia pra servir a sub-aba e este wrapper) —
 *      apagado, e o conteúdo dele voltou pra cá, de novo como dono
 *      único da tela. Zero funcionalidade nova: é o mesmo código do
 *      passo 3, só sem o nível extra de indireção que não serve mais
 *      pra nada agora que só existe um consumidor.
 *
 * PRÉ-REQUISITO (fora do código, painel do Supabase) — as tabelas
 * `likes`, `post_comments` e `posts` precisam ter a replicação em
 * tempo real ligada (Database > Publications > supabase_realtime) —
 * sem isso, as assinaturas abaixo simplesmente nunca recebem nada,
 * sem erro nenhum.
 *
 * ACTIVITY CARDS (2026-10-01, documento de UX — "o Feed parece
 * estático") — a lista deixou de ser só `Post[]`: `useFeedEntries`
 * (em vez de `usePosts`) devolve `FeedEntry[]`, uma mistura de posts
 * de verdade e atividade automática (terminou série/filme, avaliou,
 * adicionou à watchlist — ver `lib/activityFeed.ts`/`ActivityCard.tsx`),
 * intercalada por data. Curtida/comentário/enquete só existem pra
 * entradas `kind: "post"` — `postIds`/Realtime abaixo filtram por
 * isso; `ActivityCard` não tem nenhuma dessas interações (não é um
 * post real, é um reflexo do que já está nas tabelas de status).
 */
export default function FeedScreen() {
  const tabBarClearance = useTabBarClearance();
  /**
   * A PEDIDO (2026-10-01, header do Feed — "Para você / Seguindo") —
   * `scope` decide qual aba está ativa; muda a identidade de `load`
   * dentro de `useFeedEntries` (está nas deps de lá), então trocar de
   * aba já dispara a recarga sozinho, sem nenhum efeito extra aqui.
   */
  const [scope, setScope] = useState<FeedScope>("forYou");
  const { entries, isLoading, isError, refreshing, refetch } = useFeedEntries(scope);
  const { t } = useTranslation();

  const [likeInfoByPostId, setLikeInfoByPostId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  const [commentCountByPostId, setCommentCountByPostId] = useState<Map<string, number>>(new Map());
  const [pollDataByPostId, setPollDataByPostId] = useState<Map<string, PollData>>(new Map());
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);
  /**
   * UNIFICADO (2026-10-01, a pedido — "quero um único estado/indicador
   * de novidades do Feed, e não contadores visuais separados para
   * posts e atividades") — antes era `newPostsCount` (um número, só
   * de `posts`). Agora é um booleano só, aceso por QUALQUER sinal de
   * "pode haver conteúdo novo" (post escrito OU atividade automática
   * — ver os dois `useEffect` de Realtime abaixo). Deliberadamente
   * SEM contagem: os eventos de banco não correspondem 1:1 às
   * `FeedEntry`s finais (agrupamento, dedup, janela de 7 dias de
   * `activityFeed.ts` podem descartar ou fundir o que gerou o
   * evento) — um número aqui seria só aparência de precisão, por
   * isso a UI mostra só "existe novidade ou não", nunca "quantas".
   */
  const [hasNewFeedItems, setHasNewFeedItems] = useState(false);
  /**
   * POLIMENTO FINAL (2026-10-01, a pedido — achado da auditoria UI/UX:
   * "banner '↑ Novidades' sobrepõe o topo do 1º item") — CAUSA RAIZ: o
   * banner é `position: "absolute"` (ver `bannerWrapper`, abaixo) pra
   * ficar ancorado no topo independente do scroll, mas isso significa
   * que ele NUNCA empurrava o conteúdo pra baixo — `content.paddingTop`
   * (fixo, `spacing.sm`) é o mesmo com ou sem banner, e o banner nasce
   * exatamente nesse mesmo offset, cobrindo o cabeçalho do 1º card.
   * Correção MÍNIMA: mede a altura real do banner (via `onLayout` —
   * varia por idioma/tamanho de fonte, não dá pra chutar um número
   * fixo) e soma como `paddingTop` extra do conteúdo só quando
   * `hasNewFeedItems` está true — sem mudar o design nem a posição
   * visual da pílula em si (continua absoluta, continua no mesmo
   * `top`/mesmas cores/mesmo formato).
   */
  const [bannerHeight, setBannerHeight] = useState(0);
  /** Timer do debounce curto de recarga por evento Realtime (ver o `useEffect` do canal `realtime-feed-interactions`, abaixo). */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * A PEDIDO (2026-10-01, "fechar corretamente a interação que já
   * existe antes de adicionar novos comportamentos automáticos") — só
   * pra permitir `scrollToOffset` depois do toque no banner "↑
   * Novidades" (ver `handleShowNewContent`, abaixo). Deliberadamente
   * SEM `onScroll`/tracking de posição — fora do escopo desta mudança.
   */
  const listRef = useRef<FlatList<FeedEntry>>(null);

  const postIds = (entries ?? []).filter((e): e is Extract<FeedEntry, { kind: "post" }> => e.kind === "post").map((e) => e.post.id);
  const postIdsKey = postIds.join(",");

  const loadInteractions = useCallback(() => {
    if (postIds.length === 0) return;
    Promise.all([fetchLikeInfoFor("post", postIds), fetchCommentCountsFor(postIds), fetchPollDataFor(postIds)])
      .then(([likeInfo, commentCounts, pollData]) => {
        setLikeInfoByPostId(likeInfo);
        setCommentCountByPostId(commentCounts);
        setPollDataByPostId(pollData);
        setInteractionsLoaded(true);
      })
      .catch((error) => console.error("[FeedScreen] Falha ao buscar interações em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  /*
   * Cada handler lê a linha do próprio evento (`payload.new`/`payload.old`
   * — `DELETE` só tem `old`) e só chama `loadInteractions` se o post
   * afetado estiver no `Set` dos posts REALMENTE na tela agora
   * (`postIds`, calculado pouco acima) — `Set.has` em vez de
   * `Array.includes` pra não custar O(n) por evento com a lista grande.
   * `likes` guarda o post em `target_id` (o filtro `target_type=eq.post`
   * do servidor já garante que só chega curtida de post aqui, nunca de
   * comentário/review/lista); `post_comments`/`poll_votes` guardam em
   * `post_id` diretamente.
   *
   * DEBOUNCE CURTO (400ms) — uma rajada de curtidas no mesmo post (ex.:
   * 5 pessoas curtindo em poucos segundos) só dispara UMA recarga, a
   * última da rajada, ~400ms depois do último evento.
   */
  useEffect(() => {
    const visiblePostIds = new Set(postIds);

    function scheduleReload() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(loadInteractions, 400);
    }

    function handleLikeEvent(payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) {
      const postId = (payload.new?.target_id ?? payload.old?.target_id) as string | undefined;
      if (postId && visiblePostIds.has(postId)) scheduleReload();
    }

    function handlePostScopedEvent(payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) {
      const postId = (payload.new?.post_id ?? payload.old?.post_id) as string | undefined;
      if (postId && visiblePostIds.has(postId)) scheduleReload();
    }

    const channel = supabase
      .channel("realtime-feed-interactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: "target_type=eq.post" }, handleLikeEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, handlePostScopedEvent)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, handlePostScopedEvent)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital: `postIds` é um array NOVO a cada render (`entries?.filter(...)`), incluí-lo faria este efeito desmontar/remontar o canal a cada render à toa; `postIdsKey` (string derivada, já na lista) é quem de fato representa esse valor pra fins de dependência — reconstrói `visiblePostIds` sempre que o CONTEÚDO muda, não a referência.
  }, [loadInteractions, postIdsKey]);

  // Post novo de qualquer pessoa liga o indicador único de novidade
  // (`hasNewFeedItems`) — não entra sozinho na lista (empurraria o que
  // a pessoa já está lendo), só avisa, e busca de verdade quando
  // tocado (ver `handleShowNewContent`, abaixo).
  useEffect(() => {
    const channel = supabase
      .channel("realtime-feed-new-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        setHasNewFeedItems(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /**
   * ATIVIDADE AUTOMÁTICA NO REALTIME (2026-10-01, a pedido — "hoje
   * `posts` possuem Realtime... mas novas atividades só aparecem após
   * refresh"; REFEITO no mesmo dia — auditoria funcional apontou
   * Alto: o filtro original só excluía o próprio usuário, então o job
   * periódico de recálculo de categorias de série (que só toca
   * `updated_at` de séries que CONTINUAM "watching") acendia
   * `hasNewFeedItems` sem nunca poder virar nada visível no refetch;
   * e na aba "Seguindo" o canal não respeitava `followedIds` nenhum —
   * evento de QUALQUER usuário acendia o indicador, mesmo um que a
   * pessoa não segue.
   *
   * FILTROS COMBINADOS COM AND (vírgula) direto no servidor —
   * `"Filters now compose. Separate them with a comma and every
   * condition has to match"`
   * (https://supabase.com/blog/postgres-changes-filters-and-column-selection).
   * VALIDADO AO VIVO em 2026-10-01 contra este projeto, com
   * `@supabase/supabase-js@2.45.4` (anterior ao anúncio deste recurso) —
   * `scripts/realtime-filter-test.mjs`, rodado no PC (a sessão do
   * Claude não tem saída de rede pro Supabase), cobriu os 10 casos
   * pedidos (watching→watching não sinaliza = o próprio achado Alto;
   * →completed/want_to_watch sinaliza; review antiga fora da janela
   * não sinaliza; rating chegando via UPDATE sinaliza; Following
   * inclui/exclui certo; troca de aba sem duplicar) — 10/10 passaram.
   * O único caso que o filtro server-side não barra sozinho é a review
   * de episódio (season/episode) — esperado, ver nota logo abaixo —
   * exatamente por isso o bloqueio fica no callback, não no filtro.
   *
   * `movie_status`/`series_status` — filtro server-side sempre inclui
   * `status=in.(...)`, usando os MESMOS arrays exportados de
   * `lib/activityFeed.ts` (nunca duplica o literal) — sozinho já
   * resolve o falso positivo do recálculo de "watching", porque aquele
   * job nunca muda `status` pra um desses valores. `event: "*"`
   * mantido — INSERT cobre status novo, UPDATE cobre a TRANSIÇÃO pra
   * um desses valores (ex.: "watching" → "completed"), ambos
   * legítimos.
   *
   * `reviews` — filtro server-side sempre inclui `created_at=gte.<since>`
   * (mesma `ACTIVITY_WINDOW_DAYS` de `activityFeed.ts`, calculada uma
   * vez ao montar o efeito) — resolve o falso positivo de EDITAR uma
   * review antiga (linha criada fora da janela: filtro nunca bate,
   * mesmo com UPDATE). `event: "*"` MANTIDO DE PROPÓSITO, não vira
   * `"INSERT"` — conferido em código (`lib/social/reviews.ts`,
   * `upsertReview`/`onConflict`, e as chamadas separadas por campo em
   * `app/movies/[id].tsx:193-220`) que uma nota nova de verdade
   * costuma chegar como `UPDATE` numa linha que já existia (criada
   * antes por `watchedPlatform`/humor/texto, com a nota só depois) —
   * `"INSERT"` perderia esse caso. As 3 condições que faltam
   * (`rating`/`season_number`/`episode_number`) são conferidas no
   * CALLBACK, direto no payload que o Realtime já entrega de graça —
   * sem replicar o resto de `activityFeed.ts` (sem TMDB, sem join de
   * perfil, sem paginação).
   *
   * EXCLUSÃO DO PRÓPRIO USUÁRIO — na aba "Para você", via
   * `user_id=neq.<id>` server-side, combinado com vírgula junto da
   * condição de status/data. Na aba "Seguindo", implícita: o usuário
   * nunca está no próprio `followedIds`.
   *
   * ABA "SEGUINDO" SEM SUBSCRIPTION POR USUÁRIO — busca `followedIds`
   * UMA VEZ ao montar o efeito (reaproveita `fetchFollowedIds()` de
   * `useFeedEntries.ts`, não duplica a consulta). 0 seguidos → nenhum
   * listener destas 3 tabelas é criado (ninguém cujo evento
   * importaria). 1–100 seguidos → combinado server-side via
   * `user_id=in.(...)` (dentro do limite oficial do operador). Mais
   * de 100 → sem condição de `user_id` no filtro (estouraria o
   * limite), e a checagem vira um `Set.has` barato dentro do
   * callback — o fallback mínimo combinado, nunca uma subscription
   * por seguido.
   *
   * Depende de `scope` agora (antes era `[]`) — trocar de aba
   * desmonta o canal anterior e conecta um novo já com o filtro certo
   * pra aba nova; evento raro (toque manual na aba), sem assinaturas
   * duplicadas — o cleanup de sempre roda antes do próximo `setup()`.
   */
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      let currentUserId: string | null = null;
      try {
        const {
          data: { user },
        } = await getCurrentAuthUser();
        currentUserId = user?.id ?? null;
      } catch (error) {
        console.error("[FeedScreen] Falha ao buscar usuário atual pro filtro de Realtime (seguindo sem filtro de autor)", error);
      }
      if (cancelled) return;

      let followedIds: Set<string> | null = null;
      if (scope === "following") {
        // Já isolada em try/catch própria (ver useFeedEntries.ts) — falha vira Set vazio, mesmo tratamento de "ninguém seguido".
        followedIds = await fetchFollowedIds();
        if (cancelled) return;
        if (followedIds.size === 0) return; // ninguém seguido — nenhum evento destas 3 tabelas poderia importar
      }

      const MAX_IN_FILTER_VALUES = 100; // limite documentado do operador `in` do Realtime
      const followedIdsArray = followedIds ? [...followedIds] : null;
      const followedIdsFitServerSide = followedIdsArray !== null && followedIdsArray.length <= MAX_IN_FILTER_VALUES;

      // Parte do filtro relativa a QUEM — server-side quando dá (sempre no "Para você"; no "Seguindo" só até 100 seguidos).
      let authorFilter: string | null = null;
      if (scope === "following") {
        if (followedIdsFitServerSide) authorFilter = `user_id=in.(${followedIdsArray!.join(",")})`;
        // > 100 seguidos: sem condição de autor aqui — vira checagem no callback via `followedIds.has(...)`.
      } else if (currentUserId) {
        authorFilter = `user_id=neq.${currentUserId}`;
      }

      function combineFilters(base: string): string {
        return authorFilter ? `${base},${authorFilter}` : base;
      }

      // Só entra em cena quando o filtro server-side não cobriu `followedIds` (caso > 100 seguidos) — nos outros casos sempre `false` (já resolvido pelo filtro).
      function failsClientAuthorCheck(userId: string | undefined): boolean {
        if (scope === "following" && !followedIdsFitServerSide) {
          return !userId || !followedIds!.has(userId);
        }
        return false;
      }

      const markNewActivity = () => setHasNewFeedItems(true);

      function handleStatusEvent(payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) {
        const userId = (payload.new?.user_id ?? payload.old?.user_id) as string | undefined;
        if (failsClientAuthorCheck(userId)) return;
        markNewActivity();
      }

      const since = new Date();
      since.setDate(since.getDate() - ACTIVITY_WINDOW_DAYS);
      const sinceIso = since.toISOString();

      function handleReviewEvent(payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) {
        const row = payload.new;
        if (!row) return; // DELETE de review é sempre soft-delete (UPDATE em `deleted_at`) — não deveria ocorrer, defensivo mesmo assim
        if (row.rating == null) return;
        if (row.season_number != null || row.episode_number != null) return;
        if (failsClientAuthorCheck(row.user_id as string | undefined)) return;
        markNewActivity();
      }

      channel = supabase
        .channel("realtime-feed-new-activity")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "series_status", filter: combineFilters(`status=in.(${SERIES_ACTIVITY_STATUSES.join(",")})`) },
          handleStatusEvent
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "movie_status", filter: combineFilters(`status=in.(${MOVIE_ACTIVITY_STATUSES.join(",")})`) },
          handleStatusEvent
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: combineFilters(`created_at=gte.${sinceIso}`) }, handleReviewEvent)
        .subscribe();
    }

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [scope]);

  /**
   * A PEDIDO (2026-10-01, "fechar corretamente a interação que já
   * existe antes de adicionar novos comportamentos automáticos", e
   * depois unificado em "novidades" genéricas) — NÃO zera o indicador
   * antes de chamar `refetch()` (diferente da versão anterior, que
   * zerava o contador na hora do toque) — só depois de confirmado que
   * `refetch()` realmente trouxe dados novos. `refetch()` devolve
   * `true`/`false` (ver `load` em `useFeedEntries.ts`), o MESMO sinal
   * de erro que já existia (`isError`), só exposto no valor resolvido
   * da Promise — sem sistema de erro novo. Em falha: não limpa
   * `hasNewFeedItems` (o indicador continua visível, permitindo tocar
   * de novo) e não rola a tela — a tela já mostra o erro existente
   * (`isError` → `<PageError>`); rolar pro topo nesse caso pareceria
   * que dados novos chegaram quando não chegou nada.
   */
  async function handleShowNewContent() {
    const success = await refetch();
    if (success) {
      setHasNewFeedItems(false);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }

  /**
   * POLIMENTO FINAL (2026-10-01, a pedido — achado da auditoria UI/UX:
   * "pull-to-refresh não limpa o indicador '↑ Novidades'") — antes, os
   * 4 `RefreshControl` da tela chamavam `onRefresh={refetch}` direto:
   * os dados atualizavam, mas `hasNewFeedItems` nunca era reavaliado,
   * então a pílula continuava visível mesmo depois de a pessoa já ter
   * puxado pra atualizar. Mesma regra de `handleShowNewContent` (acima)
   * — só apaga o aviso quando `refetch()` confirma sucesso (`true`);
   * em falha total/parcial, mantém visível (permite tentar nos dois
   * jeitos: puxando de novo OU tocando a pílula). DELIBERADAMENTE sem
   * `scrollToOffset` aqui (diferente do toque na pílula) — puxar pra
   * atualizar já é, por si, um gesto manual no topo da lista; rolar a
   * tela sozinho por cima disso seria um movimento que a pessoa não
   * pediu.
   */
  async function handlePullToRefresh() {
    const success = await refetch();
    if (success) {
      setHasNewFeedItems(false);
    }
  }

  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-29, "a rolagem do feed está
   * travando") — antes, `renderItem` era uma arrow function inline:
   * identidade NOVA a cada render de `FeedScreen` (o que acontece a
   * cada evento Realtime de curtida/comentário/enquete, ver
   * `loadInteractions`, acima). `useCallback` aqui + o `memo` novo em
   * `PostCard.tsx` (com comparação por VALOR, não por referência dos
   * Maps) são as DUAS metades do mesmo conserto — uma sem a outra não
   * resolve: `useCallback` sozinho não evitaria recalcular os cards se
   * `PostCard` não soubesse comparar `likeInfo`/`commentCount`/
   * `pollInfo` por valor; `memo` sozinho não adiantaria se `renderItem`
   * continuasse instável.
   */
  const renderEntry: ListRenderItem<FeedEntry> = useCallback(
    ({ item, index }) => {
      switch (item.kind) {
        case "post":
          return (
            <FeedItemEnter index={index}>
              <PostCard
                post={item.post}
                onDeleted={refetch}
                likeInfo={likeInfoByPostId.get(item.post.id)}
                commentCount={commentCountByPostId.get(item.post.id)}
                pollInfo={pollDataByPostId.get(item.post.id)}
              />
            </FeedItemEnter>
          );
        case "activity":
          return (
            <FeedItemEnter index={index}>
              <ActivityCard item={item.activity} heroEligible={item.heroEligible} />
            </FeedItemEnter>
          );
        case "activityGroup":
          return (
            <FeedItemEnter index={index}>
              <ActivityGroupCard group={item.group} />
            </FeedItemEnter>
          );
        case "trending":
          // Módulo de "quebra de padrão" (em alta) — ver `lib/useFeedEntries.ts`;
          // sem stagger de índice: é um módulo único, não uma lista.
          return (
            <FeedItemEnter>
              <FeedTrendingModule items={item.items} />
            </FeedItemEnter>
          );
        case "friendsWatching":
          return (
            <FeedItemEnter>
              <FeedFriendsWatchingModule items={item.items} />
            </FeedItemEnter>
          );
      }
    },
    [refetch, likeInfoByPostId, commentCountByPostId, pollDataByPostId]
  );

  // Ver comentário grande de `bannerHeight`, acima — espaço extra só
  // existe enquanto o banner está de fato visível, do tamanho real
  // medido dele (não um valor fixo chutado).
  const reservedTopStyle = hasNewFeedItems ? { paddingTop: spacing.sm + bannerHeight } : undefined;

  return (
    <Screen padded={false}>
      <FeedHeader scope={scope} onChangeScope={setScope} />

      {/*
       * A PEDIDO (2026-10-01, header do Feed) — tudo que já existia
       * aqui (o aviso de posts novos, os 4 estados e o botão de criar
       * post) entra numa `View` própria com `flex: 1` logo embaixo do
       * header. Sem isso, `bannerWrapper` (abaixo, `position:
       * "absolute", top: spacing.sm`) ficaria ancorado no `<Screen>`
       * inteiro — ou seja, embaixo do próprio header, não no topo do
       * conteúdo — e apareceria flutuando por cima do título/abas.
       * `CreatePostButton` já se ancora pelo `bottom`, então não é
       * afetado por essa troca.
       */}
      <View style={styles.body}>
        {hasNewFeedItems && (
          <View style={styles.bannerWrapper}>
            <Pressable style={styles.banner} onPress={handleShowNewContent} onLayout={(e) => setBannerHeight(e.nativeEvent.layout.height)}>
              <Feather name="arrow-up" size={14} color={colors.background} strokeWidth={2.5} />
              <Text style={styles.bannerText}>{t("feed.newContentAvailable")}</Text>
            </Pressable>
          </View>
        )}

        {isError ? (
          <ScrollView
            contentContainerStyle={[styles.content, reservedTopStyle, { paddingBottom: tabBarClearance }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={colors.primary} />}
          >
            <PageError message={t("feed.errorLoadFeed")} onRetry={() => refetch()} />
          </ScrollView>
        ) : isLoading ? (
          <ScrollView
            contentContainerStyle={[styles.content, reservedTopStyle, { paddingBottom: tabBarClearance }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={colors.primary} />}
          >
            <PostCardSkeleton bare />
          </ScrollView>
        ) : !entries || entries.length === 0 ? (
          // `EmptyShelf` é o padrão único de estado vazio do app. Sem
          // `actionLabel` — o botão flutuante de criar post
          // (`CreatePostButton`, abaixo) já é o CTA visível o tempo todo
          // nesta tela. Mensagem muda por aba (2026-10-01): "Seguindo"
          // vazio não é o mesmo problema de "Para você" vazio (lista de
          // seguidos vazia/sem posts recentes vs. Feed geral vazio).
          //
          // ÍCONE POR ABA (2026-10-01, a pedido — achado da auditoria
          // UI/UX: "edit-3" [lápis] não combina com a mensagem de
          // "Seguindo vazio", que fala de encontrar PESSOAS pra seguir,
          // não de escrever algo) — "Para você" vazio continua com
          // "edit-3" (mensagem de lá É sobre escrever o 1º post);
          // "Seguindo" vazio passa a usar "users" (mesmo ícone já usado
          // no cabeçalho do módulo "Seus amigos estão assistindo", ver
          // `FeedFriendsWatchingModule.tsx`).
          <ScrollView
            contentContainerStyle={[styles.content, reservedTopStyle, { paddingBottom: tabBarClearance }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={colors.primary} />}
          >
            <EmptyShelf icon={scope === "following" ? "users" : "edit-3"} message={scope === "following" ? t("feed.emptyFollowing") : t("feed.emptyFeed")} />
          </ScrollView>
        ) : (
          // `FlatList` virtualiza — chegou a ter até 30 `PostCard`s ricos
          // (imagem de review e/ou foto anexada, curtida, comentários,
          // enquete) montados de uma vez com `ScrollView` + `.map()` antes
          // desta troca. `POSTS_LIMIT` (em `lib/posts.ts`) não muda aqui.
          <FlatList
            ref={listRef}
            data={entries}
            keyExtractor={(entry) => entry.id}
            contentContainerStyle={[styles.content, styles.list, reservedTopStyle, { paddingBottom: tabBarClearance }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={colors.primary} />}
            initialNumToRender={6}
            windowSize={7}
            maxToRenderPerBatch={6}
            renderItem={renderEntry}
          />
        )}

        <CreatePostButton onCreated={refetch} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  // A PEDIDO (2026-09-29, "feed igual Threads") — sem espaço entre posts: cada `PostCard`/`ActivityCard` já desenha sua própria linha divisória embaixo (`styles.card` em cada um).
  list: {
    gap: 0,
  },
  bannerWrapper: {
    position: "absolute",
    top: spacing.sm,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    shadowColor: elevation.medium.shadowColor,
    shadowOpacity: elevation.medium.shadowOpacity,
    shadowRadius: elevation.medium.shadowRadius,
    shadowOffset: elevation.medium.shadowOffset,
    elevation: elevation.medium.elevation,
  },
  bannerText: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
