"use client";

import { ArrowUp } from "lucide-react";
import { usePosts } from "@/lib/queries/posts";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PostCard } from "./PostCard";
import { CreatePostButton } from "./CreatePostButton";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useSavedStatusesBatch } from "@/lib/queries/saved-posts";
import { useCommentCountsBatch } from "@/lib/queries/post-comments";
import { useRealtimePublicInvalidate } from "@/lib/supabase/useRealtimePublicInvalidate";
import { useNewPostsBanner } from "@/lib/queries/social/useNewPostsBanner";

/**
 * TASK-063 — removida a seção "Descobrir" (cards de séries/filmes em
 * alta) que existia aqui dentro: ela duplicava a aba "DESCOBRIR" ao
 * lado de "FEED" (mesma tela, mesmo conteúdo — trending do TMDB —
 * em dois lugares). Junto foi removida toda a lógica que só existia
 * pra alimentar essa seção (useDiscoverList, o fetch de duração/
 * temporadas por item, o estado de extraInfo). O Feed agora mostra
 * só os posts de texto (usePosts/CreatePostButton), como o resto do
 * comentário original desta tarefa já descrevia como "seção própria".
 *
 * TASK-074 — a exigência de escolher categoria antes de ver o Feed
 * (TASK-059, "enquanto o usuário não selecionar pelo menos uma
 * categoria, o Feed não será exibido") saiu. `usePosts()` nunca
 * chegou a filtrar por categoria de verdade (sempre trouxe todos os
 * posts, em ordem cronológica) — a única coisa que essa exigência
 * fazia era esconder o Feed inteiro atrás de uma tela de onboarding
 * até a pessoa escolher algo. Agora entra direto, mostrando todos os
 * posts pra todo mundo. `FeedOnboarding` ficou sem nenhum lugar que
 * a use — não apagado, só parado, caso vire uma preferência
 * opcional no futuro (não uma barreira de entrada).
 *
 * AUDITORIA — curtida/salvo/contagem de comentário de todos os posts
 * visíveis agora são buscados em lote (3 consultas no total, não até
 * 4 por post) assim que a lista chega, e repassados prontos pra cada
 * `PostCard` — mesmo padrão já usado no Feed mobile (TASK-153).
 *
 * A PEDIDO — "Feed mais vivo":
 * - Curtida/comentário de QUALQUER pessoa atualiza sozinho, sem
 *   precisar recarregar (`useRealtimePublicInvalidate`, invalida por
 *   PREFIXO já que a chave exata do lote muda a cada lista de posts
 *   diferente — `exact: false`).
 * - Post novo NÃO entra sozinho na lista (empurraria o que a pessoa
 *   já está lendo) — só aparece um aviso no topo, que busca de
 *   verdade só quando tocado (`useNewPostsBanner`).
 * - Post entrando na lista (via o aviso, ou recarregando a tela)
 *   desliza suavemente em vez de só "estar lá" — `animate-in`.
 */
export function ExploreFeedTab() {
  const { data: posts, isLoading: postsLoading } = usePosts();
  const postIds = posts?.map((p) => p.id) ?? [];
  const { t } = useTranslation();

  const { data: likeInfoByPostId } = useLikeInfoBatch("post", postIds);
  const { data: savedPostIds } = useSavedStatusesBatch(postIds);
  const { data: commentCountByPostId } = useCommentCountsBatch(postIds);

  // Curtida de post de qualquer pessoa (não só a minha) faz a contagem
  // e o coração preenchido atualizarem sozinhos, na hora.
  useRealtimePublicInvalidate(["likes"], ["like-info-batch"], { filter: "target_type=eq.post", exact: false });
  // Comentário novo em qualquer post atualiza a contagem sozinho.
  useRealtimePublicInvalidate(["post_comments"], ["post-comment-counts-batch"], { exact: false });

  const { newPostsCount, showNewPosts } = useNewPostsBanner();

  return (
    <>
      <div className="space-y-4 px-4 pt-4 pb-6">
        {newPostsCount > 0 && (
          <button
            type="button"
            onClick={showNewPosts}
            className="sticky top-2 z-10 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-background shadow-lg transition-transform active:scale-95"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            {newPostsCount === 1 ? t("feed.newPostAvailable") : t("feed.newPostsAvailable", { count: newPostsCount })}
          </button>
        )}

        {postsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <div key={post.id} className="feed-item-enter">
                <PostCard
                  post={post}
                  likeInfo={likeInfoByPostId?.get(post.id)}
                  isSaved={savedPostIds?.has(post.id)}
                  commentCount={commentCountByPostId?.get(post.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-surface p-4 text-center text-sm text-muted">
            {t("feed.emptyFeed")}
          </p>
        )}
      </div>

      <CreatePostButton />
    </>
  );
}
