"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { usePostComments, useCreatePostComment } from "@/lib/queries/post-comments";
import { useHasLiked, useLikeCount, useToggleLike } from "@/lib/queries/social/likes";
import { buildPostCommentTree, findCommentNode, PostCommentItem } from "./PostCommentItem";
import { cn } from "@seenlist/utils";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-064 — tela dedicada de comentário: abre ao tocar em
 * "Responder" num comentário (em vez do campo inline que existia
 * antes). Mostra o comentário-pai em destaque no topo, as respostas
 * que ele já tem logo abaixo, e um composer fixo que grava a
 * resposta nova já com `parent_comment_id` apontando pra este
 * comentário — o mesmo problema que causava respostas soltas (sem
 * vínculo) não se repete aqui porque só existe UM lugar que envia
 * pra `parentCommentId`, e ele já nasce fixo no ID da rota.
 */
export function PostCommentDetailView({ postId, commentId }: { postId: string; commentId: string }) {
  const { data: comments, isLoading } = usePostComments(postId);
  const createComment = useCreatePostComment(postId);
  const [body, setBody] = useState("");

  const tree = useMemo(() => buildPostCommentTree(comments ?? []), [comments]);
  const comment = useMemo(() => findCommentNode(tree, commentId), [tree, commentId]);

  const { data: hasLiked } = useHasLiked("post_comment", commentId);
  const { data: likeCount } = useLikeCount("post_comment", commentId);
  const toggleLike = useToggleLike("post_comment", commentId);

  function handleSubmit() {
    if (!body.trim()) return;
    createComment.mutate(
      { body: body.trim(), parentCommentId: commentId },
      { onSuccess: () => setBody("") }
    );
  }

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href={`/explore/posts/${postId}`} aria-label="Voltar" className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">Comentário</h1>
      </div>

      <div className="px-4 pt-4">
        {isLoading && <div className="h-24 animate-pulse rounded-xl bg-surface" />}

        {!isLoading && !comment && (
          <p className="text-center text-sm text-muted">Este comentário não existe mais.</p>
        )}

        {comment && (
          <>
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-text">{comment.authorName}</p>
                <p className="text-xs text-muted">{dateFormatter.format(new Date(comment.createdAt))}</p>
              </div>
              <p className="mt-1 text-sm text-text">{comment.body}</p>
              <button
                type="button"
                onClick={() => toggleLike.mutate(Boolean(hasLiked))}
                className={cn("mt-2 flex items-center gap-1 text-xs", hasLiked ? "text-primary" : "text-muted")}
              >
                <Heart className="h-3.5 w-3.5" strokeWidth={2} fill={hasLiked ? "currentColor" : "none"} />
                {likeCount ?? 0}
              </button>
            </div>

            <div className="mt-3 border-t border-border pt-2">
              {comment.children.length === 0 ? (
                <p className="py-2 text-xs text-muted">Nenhuma resposta ainda.</p>
              ) : (
                comment.children.map((child) => (
                  <PostCommentItem key={child.id} comment={child} postId={postId} depth={0} />
                ))
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva uma resposta..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!body.trim() || createComment.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
