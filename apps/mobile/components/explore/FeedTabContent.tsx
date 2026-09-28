import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, FlatList, RefreshControl, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { usePosts } from "@/lib/usePosts";
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
 * A PEDIDO (2026-09-28, "quero religar a aba feed... vai ficar como uma
 * sub aba dentro de explorar") — CAUSA/CONTEXTO: o Feed tinha sido
 * descontinuado em 2026-08-22 (dado real de uso: 20 follows/383
 * usuários, 3 posts/7 dias, 0,0 posts-comentários por usuário ativo —
 * ver comentário em `app/(tabs)/_layout.tsx`) e virado uma 5ª aba
 * escondida (`href: null`). Religado, mas por pedido explícito NÃO
 * como aba própria de novo — como 1ª sub-aba de "Explorar"
 * (`app/(tabs)/explore.tsx`), ao lado de Filmes/Séries/Atividade.
 *
 * Este arquivo é o conteúdo do antigo `app/(tabs)/feed.tsx` (TASK-095/153)
 * EXTRAÍDO pra um componente reaproveitável — mesma lógica, curtida
 * real, contagens em lote, Realtime (curtidas/comentários/enquetes/
 * posts novos), sem duplicar nada: `app/(tabs)/feed.tsx` (a rota
 * antiga, que continua existindo, sem link nenhum na barra) e a nova
 * sub-aba de Explorar usam este mesmo componente.
 *
 * SEM `<Screen>` PRÓPRIO DE PROPÓSITO (diferente do antigo
 * `FeedScreen`) — quem monta este componente como sub-aba
 * (`explore.tsx`) já fornece o `<Screen>`/`GlassTargetProvider` da
 * tela (mesmo padrão já usado por `ActivityTabContent`, ali mesmo) —
 * ganha de graça o mesmo fundo de vidro do resto do Explorar, em vez
 * do fundo chapado que o Feed tinha sozinho antes.
 *
 * PRÉ-REQUISITO (fora do código, painel do Supabase) — as tabelas
 * `likes`, `post_comments` e `posts` precisam ter a replicação em
 * tempo real ligada (Database > Publications > supabase_realtime) —
 * sem isso, as assinaturas abaixo simplesmente nunca recebem nada,
 * sem erro nenhum.
 */
export function FeedTabContent() {
  const tabBarClearance = useTabBarClearance();
  const { posts, isLoading, isError, refreshing, refetch } = usePosts();
  const { t } = useTranslation();

  const [likeInfoByPostId, setLikeInfoByPostId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  const [commentCountByPostId, setCommentCountByPostId] = useState<Map<string, number>>(new Map());
  const [pollDataByPostId, setPollDataByPostId] = useState<Map<string, PollData>>(new Map());
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);
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
      .catch((error) => console.error("[FeedTabContent] Falha ao buscar interações em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `postIds` é um array NOVO a cada render; `postIdsKey` (string derivada) representa o valor de verdade pra fins de dependência.
  }, [loadInteractions, postIdsKey]);

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

  return (
    <View style={styles.flexFill}>
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
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <EmptyShelf icon="edit-3" message={t("feed.emptyFeed")} />
        </ScrollView>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          contentContainerStyle={[styles.content, styles.list, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
          initialNumToRender={6}
          windowSize={7}
          maxToRenderPerBatch={6}
          renderItem={({ item: post }) => (
            <FeedItemEnter>
              <PostCard
                post={post}
                onDeleted={refetch}
                likeInfo={likeInfoByPostId.get(post.id)}
                commentCount={commentCountByPostId.get(post.id)}
                pollInfo={pollDataByPostId.get(post.id)}
              />
            </FeedItemEnter>
          )}
        />
      )}

      <CreatePostButton onCreated={refetch} />
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
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
