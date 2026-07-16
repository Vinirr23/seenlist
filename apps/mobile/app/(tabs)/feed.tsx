import { useEffect, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { Screen, Text } from "@/components/ui";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { usePosts } from "@/lib/usePosts";
import { PostCard } from "@/components/feed/PostCard";
import { CreatePostButton } from "@/components/feed/CreatePostButton";
import { fetchLikeInfoFor, fetchCommentCountsFor } from "@/lib/social/likes";
import { fetchSavedStatusesFor } from "@/lib/social/savedPosts";
import { fetchPollDataFor, type PollData } from "@/lib/social/polls";
import { colors, spacing } from "@/lib/theme";

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
 */
export default function FeedScreen() {
  const { posts, isLoading, isError, refreshing, refetch } = usePosts();

  const [likeInfoByPostId, setLikeInfoByPostId] = useState<Map<string, { count: number; hasLiked: boolean }>>(new Map());
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [commentCountByPostId, setCommentCountByPostId] = useState<Map<string, number>>(new Map());
  const [pollDataByPostId, setPollDataByPostId] = useState<Map<string, PollData>>(new Map());
  const [interactionsLoaded, setInteractionsLoaded] = useState(false);

  useEffect(() => {
    if (!posts || posts.length === 0) return;
    const postIds = posts.map((p) => p.id);
    Promise.all([fetchLikeInfoFor("post", postIds), fetchSavedStatusesFor(postIds), fetchCommentCountsFor(postIds), fetchPollDataFor(postIds)])
      .then(([likeInfo, saved, commentCounts, pollData]) => {
        setLikeInfoByPostId(likeInfo);
        setSavedPostIds(saved);
        setCommentCountByPostId(commentCounts);
        setPollDataByPostId(pollData);
        setInteractionsLoaded(true);
      })
      .catch((error) => console.error("[FeedScreen] Falha ao buscar interações em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts?.map((p) => p.id).join(",")]);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isError ? (
          <Text variant="muted" style={styles.centerText}>
            Não foi possível carregar o Feed agora. Tente de novo em instantes.
          </Text>
        ) : isLoading ? (
          <PostCardSkeleton />
        ) : !posts || posts.length === 0 ? (
          <Text variant="muted" style={styles.centerText}>
            Ninguém publicou nada ainda. Seja o primeiro — toque no botão + aqui embaixo.
          </Text>
        ) : (
          <View style={styles.list}>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={refetch}
                likeInfo={likeInfoByPostId.get(post.id)}
                isSaved={interactionsLoaded ? savedPostIds.has(post.id) : undefined}
                commentCount={commentCountByPostId.get(post.id)}
                pollInfo={pollDataByPostId.get(post.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CreatePostButton onCreated={refetch} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
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
});
