import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, FlatList, RefreshControl, Pressable, StyleSheet, type ListRenderItem } from "react-native";
import * as Updates from "expo-updates";
import { Feather } from "@expo/vector-icons";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { usePosts } from "@/lib/usePosts";
import type { Post } from "@/lib/posts";
import { PostCard } from "@/components/feed/PostCard";
import { FeedItemEnter } from "@/components/feed/FeedItemEnter";
import { CreatePostButton } from "@/components/feed/CreatePostButton";
import { fetchLikeInfoFor, fetchCommentCountsFor } from "@/lib/social/likes";
import { fetchPollDataFor, type PollData } from "@/lib/social/polls";
import { supabase } from "@/lib/supabase";
import { colors, spacing, radius, elevation, fontSize } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-095/153 — Feed nativo: lista de posts reais do Supabase, curtida
 * de verdade, contagem de comentários real, Realtime (curtidas/
 * comentários/enquetes/posts novos).
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
 */
export default function FeedScreen() {
  const tabBarClearance = useTabBarClearance();
  const { posts, isLoading, isError, refreshing, refetch } = usePosts();
  const { t } = useTranslation();

  const [likeInfoByPostId, setLikeInfoByPostId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  const [commentCountByPostId, setCommentCountByPostId] = useState<Map<string, number>>(new Map());
  const [pollDataByPostId, setPollDataByPostId] = useState<Map<string, PollData>>(new Map());
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
  /** Timer do debounce curto de recarga por evento Realtime (ver o `useEffect` do canal `realtime-feed-interactions`, abaixo). */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const postIds = posts?.map((p) => p.id) ?? [];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital: `postIds` é um array NOVO a cada render (`posts?.map(...)`), incluí-lo faria este efeito desmontar/remontar o canal a cada render à toa; `postIdsKey` (string derivada, já na lista) é quem de fato representa esse valor pra fins de dependência — reconstrói `visiblePostIds` sempre que o CONTEÚDO muda, não a referência.
  }, [loadInteractions, postIdsKey]);

  // Post novo de qualquer pessoa NÃO entra sozinho na lista (empurraria
  // o que a pessoa já está lendo) — só conta, mostra um aviso, e busca
  // de verdade quando tocado.
  useEffect(() => {
    const channel = supabase
      .channel("realtime-feed-new-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        setNewPostsCount((n) => n + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function handleShowNewPosts() {
    setNewPostsCount(0);
    refetch();
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
  const renderPost: ListRenderItem<Post> = useCallback(
    ({ item: post }) => (
      <FeedItemEnter>
        <PostCard
          post={post}
          onDeleted={refetch}
          likeInfo={likeInfoByPostId.get(post.id)}
          commentCount={commentCountByPostId.get(post.id)}
          pollInfo={pollDataByPostId.get(post.id)}
        />
      </FeedItemEnter>
    ),
    [refetch, likeInfoByPostId, commentCountByPostId, pollDataByPostId]
  );

  return (
    <Screen padded={false}>
      {/* DIAGNÓSTICO TEMPORÁRIO (2026-09-29) — remover depois de confirmar se o update OTA está mesmo chegando no aparelho. */}
      <Text style={{ fontSize: 10, color: "red", paddingHorizontal: spacing.md, paddingTop: 4 }}>
        update: {Updates.updateId ?? "embutido/nenhum"} · embedded: {String(Updates.isEmbeddedLaunch)}
      </Text>
      {newPostsCount > 0 && (
        <View style={styles.bannerWrapper}>
          <Pressable style={styles.banner} onPress={handleShowNewPosts}>
            <Feather name="arrow-up" size={14} color={colors.background} strokeWidth={2.5} />
            <Text style={styles.bannerText}>
              {newPostsCount === 1 ? t("feed.newPostAvailable") : t("feed.newPostsAvailable", { count: newPostsCount })}
            </Text>
          </Pressable>
        </View>
      )}

      {isError ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <PageError message={t("feed.errorLoadFeed")} onRetry={() => refetch()} />
        </ScrollView>
      ) : isLoading ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <PostCardSkeleton />
        </ScrollView>
      ) : !posts || posts.length === 0 ? (
        // `EmptyShelf` é o padrão único de estado vazio do app. Sem
        // `actionLabel` — o botão flutuante de criar post
        // (`CreatePostButton`, abaixo) já é o CTA visível o tempo todo
        // nesta tela.
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <EmptyShelf icon="edit-3" message={t("feed.emptyFeed")} />
        </ScrollView>
      ) : (
        // `FlatList` virtualiza — chegou a ter até 30 `PostCard`s ricos
        // (imagem de review e/ou foto anexada, curtida, comentários,
        // enquete) montados de uma vez com `ScrollView` + `.map()` antes
        // desta troca. `POSTS_LIMIT` (em `lib/posts.ts`) não muda aqui.
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          contentContainerStyle={[styles.content, styles.list, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
          initialNumToRender={6}
          windowSize={7}
          maxToRenderPerBatch={6}
          renderItem={renderPost}
        />
      )}

      <CreatePostButton onCreated={refetch} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  list: {
    gap: spacing.md,
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
