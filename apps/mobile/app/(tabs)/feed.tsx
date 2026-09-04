import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { usePosts } from "@/lib/usePosts";
import { PostCard } from "@/components/feed/PostCard";
import { FeedItemEnter } from "@/components/feed/FeedItemEnter";
import { CreatePostButton } from "@/components/feed/CreatePostButton";
import { fetchLikeInfoFor, fetchCommentCountsFor } from "@/lib/social/likes";
import { fetchPollDataFor, type PollData } from "@/lib/social/polls";
import { supabase } from "@/lib/supabase";
import { colors, spacing, radius, elevation } from "@/lib/theme";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-095/153 — primeira versão do Feed nativo: lista de posts
 * reais do Supabase, curtida de verdade, contagem de comentários
 * real.
 *
 * Correção (TASK-153 — Feed lento): antes, cada `PostCard`
 * (curtir/salvar/contagem de comentário) buscava seus próprios dados
 * sozinho — com vários posts na tela, viravam dezenas de consultas
 * soltas. Agora busca tudo dos posts visíveis de uma vez (3
 * consultas no total, não 4 por post) assim que a lista chega, e
 * repassa pronto pra cada `PostCard`.
 *
 * A PEDIDO — "Feed mais vivo" (mesma implementação do web, porta
 * fiel):
 * - Curtida/comentário de QUALQUER pessoa atualiza sozinho — assina
 *   as tabelas certas no Supabase Realtime e refaz a busca em lote
 *   (já é barata, 2 consultas) quando algo muda, sem esperar a
 *   pessoa sair e voltar da aba.
 * - Post novo NÃO entra sozinho na lista — só aparece um aviso fixo
 *   no topo, que busca de verdade só quando tocado.
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

  // Curtida de post de qualquer pessoa (não só a minha) e comentário
  // novo em qualquer post fazem os números atualizarem sozinhos.
  useEffect(() => {
    const channel = supabase
      .channel("realtime-feed-interactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: "target_type=eq.post" }, loadInteractions)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, loadInteractions)
      // CORREÇÃO (a pedido — "resposta de enquete não atualiza") —
      // `poll_votes` nunca teve inscrição nenhuma: voto de outra
      // pessoa só aparecia recarregando a tela. As outras duas
      // tabelas já estavam aqui desde sempre.
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, loadInteractions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInteractions]);

  // Post novo de qualquer pessoa NÃO entra sozinho na lista (empurraria
  // o que a pessoa já está lendo) — só conta, mostra um aviso, e
  // busca de verdade quando tocado.
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
    <Screen padded={false}>
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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isError ? (
          <PageError message={t("feed.errorLoadFeed")} onRetry={() => refetch()} />
        ) : isLoading ? (
          <PostCardSkeleton />
        ) : !posts || posts.length === 0 ? (
          <Text variant="muted" style={styles.centerText}>
            {t("feed.emptyFeed")}
          </Text>
        ) : (
          <View style={styles.list}>
            {posts.map((post) => (
              <FeedItemEnter key={post.id}>
                <PostCard
                  post={post}
                  onDeleted={refetch}
                  likeInfo={likeInfoByPostId.get(post.id)}
                  commentCount={commentCountByPostId.get(post.id)}
                  pollInfo={pollDataByPostId.get(post.id)}
                />
              </FeedItemEnter>
            ))}
          </View>
        )}
      </ScrollView>

      <CreatePostButton onCreated={refetch} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
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
    fontSize: 12,
    fontWeight: "700",
  },
});
