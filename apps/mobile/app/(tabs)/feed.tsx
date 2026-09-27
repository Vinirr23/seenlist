import { useCallback, useEffect, useRef, useState } from "react";
import { View, ScrollView, FlatList, RefreshControl, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Screen, Text } from "@/components/ui";
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
  /** ETAPA 2, item 4 — timer do debounce curto de recarga por evento Realtime (ver o `useEffect` do canal `realtime-feed-interactions`, abaixo). */
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

  /**
   * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance —
   * ETAPA 2, item 4: "Feed Realtime — eventos irrelevantes") —
   * confirmado no código atual (pós-migração pra `FlatList` da Etapa
   * 1A): as 3 assinaturas abaixo escutavam `likes`/`post_comments`/
   * `poll_votes` SEM checar se a linha alterada pertence a algum post
   * realmente exibido nesta tela — curtida/comentário/voto em
   * QUALQUER post do app (inclusive de gente que a pessoa nem segue,
   * se a RLS permitir leitura pública) disparava `loadInteractions()`
   * (3 consultas em lote) mesmo sem nenhum dos posts visíveis ter
   * mudado.
   *
   * Fix: cada handler agora lê a linha do próprio evento
   * (`payload.new`/`payload.old` — `DELETE` só tem `old`) e só chama
   * `loadInteractions` se o post afetado estiver no
   * `Set` dos posts REALMENTE na tela agora (`postIds`, calculado
   * pouco acima) — `Set.has` em vez de `Array.includes` pra não
   * custar O(n) por evento com a lista grande. `likes` guarda o post
   * em `target_id` (o filtro `target_type=eq.post` do servidor já
   * garante que só chega curtida de post aqui, nunca de comentário/
   * review/lista); `post_comments`/`poll_votes` guardam em `post_id`
   * diretamente.
   *
   * DEBOUNCE CURTO (400ms) — pedido explícito da etapa: "se múltiplos
   * eventos legítimos chegarem em sequência, avalie um debounce curto
   * só se necessário". Uma rajada de curtidas no mesmo post (ex.: 5
   * pessoas curtindo em poucos segundos) antes disparava 5 recargas
   * completas; agora só a última da rajada dispara, ~400ms depois do
   * último evento — imperceptível pra quem está lendo (bem abaixo do
   * "atraso perceptível" que a etapa pede pra evitar), mas elimina
   * round-trips redundantes. Atualização em tempo real dos posts
   * exibidos continua preservada — só deixa de recarregar por posts
   * que não aparecem na tela.
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
      // CORREÇÃO (a pedido — "resposta de enquete não atualiza") —
      // `poll_votes` nunca teve inscrição nenhuma: voto de outra
      // pessoa só aparecia recarregando a tela. As outras duas
      // tabelas já estavam aqui desde sempre.
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, handlePostScopedEvent)
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital, mesmo motivo do `loadInteractions` acima: `postIds` é um array NOVO a cada render (`posts?.map(...)`), incluí-lo faria este efeito desmontar/remontar o canal a cada render à toa; `postIdsKey` (string derivada, já na lista) é quem de fato representa esse valor pra fins de dependência — reconstrói `visiblePostIds` sempre que o CONTEÚDO muda, não a referência.
  }, [loadInteractions, postIdsKey]);

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
        // FASE 2 (consistência visual sistêmica, 2026-09-26) — era
        // `<Text variant="muted">` solto; `EmptyShelf` já é o padrão
        // único de estado vazio do app. Sem `actionLabel` — o botão
        // flutuante de criar post (`CreatePostButton`, abaixo) já é
        // o CTA visível o tempo todo nesta tela.
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <EmptyShelf icon="edit-3" message={t("feed.emptyFeed")} />
        </ScrollView>
      ) : (
        /*
         * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance
         * — item 4.5: "Feed principal → FlatList") — era `ScrollView` +
         * `posts.map()`, montando até 30 `PostCard`s ricos (imagem de
         * review e/ou foto anexada, curtida, comentários, enquete) de
         * uma vez, mesmo os que estão fora da tela. `FlatList`
         * virtualiza; `POSTS_LIMIT` (em `lib/posts.ts`) não mudou nesta
         * correção. `FeedItemEnter`, pull-to-refresh, estados de
         * erro/vazio/loading, Realtime (curtidas/comentários/enquetes/
         * posts novos) e a navegação continuam exatamente iguais — só
         * a forma de desenhar a lista mudou.
         */
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
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
    fontWeight: "700",
  },
});
