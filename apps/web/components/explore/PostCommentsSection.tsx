"use client";

import { useMemo, useState } from "react";
import { usePostComments, useCreatePostComment } from "@/lib/queries/post-comments";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PostCommentItem, buildPostCommentTree } from "./PostCommentItem";

/** TASK-064 — o composer aqui agora é só pra comentário novo (raiz); responder a um comentário existente abre `/explore/posts/[postId]/comment/[commentId]`. */
export function PostCommentsSection({ postId }: { postId: string }) {
  const { data: comments, isLoading } = usePostComments(postId);
  const createComment = useCreatePostComment(postId);
  const [body, setBody] = useState("");
  const { t } = useTranslation();

  const tree = useMemo(() => buildPostCommentTree(comments ?? []), [comments]);

  /** AUDITORIA (perf) — 1 consulta pra todos os comentários (incluindo respostas aninhadas) visíveis, não uma por comentário. */
  const allCommentIds = useMemo(() => (comments ?? []).map((c) => c.id), [comments]);
  const { data: likeInfoByCommentId } = useLikeInfoBatch("post_comment", allCommentIds);

  function handleSubmit() {
    if (!body.trim()) return;
    createComment.mutate(
      { body: body.trim(), parentCommentId: null },
      { onSuccess: () => setBody("") }
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-2">
      {isLoading ? (
        <div className="h-10 animate-pulse rounded bg-background" />
      ) : tree.length === 0 ? (
        <p className="py-2 text-xs text-muted">{t("social.noCommentsYet")}</p>
      ) : (
        tree.map((node) => <PostCommentItem key={node.id} comment={node} postId={postId} depth={0} likeInfoByCommentId={likeInfoByCommentId} />)
      )}

      <div className="mt-2">
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("social.commentPlaceholder")}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!body.trim() || createComment.isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
          >
            {t("common.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
