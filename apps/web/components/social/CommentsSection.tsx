"use client";

import { useMemo } from "react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useComments, usePostComment, useEditComment, useDeleteComment, type Comment } from "@/lib/queries/social/comments";
import { useSpoilerProtection } from "@/lib/queries/social/spoiler-protection";
import { useCurrentUser } from "@/lib/queries/current-user";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import { EmptyState } from "../search/EmptyState";

interface CommentNode extends Comment {
  children: CommentNode[];
}

function buildTree(comments: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const comment of comments) byId.set(comment.id, { ...comment, children: [] });

  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = byId.get(comment.id) as CommentNode;
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export interface CommentsSectionProps {
  target: MediaTarget;
  /** Só faz sentido quando o alvo é um episódio — usado pra oclusão automática por progresso (TASK-031). */
  episodeSpoilerContext?: { seriesId: number; seasonNumber: number; episodeNumber: number };
  /** TASK-052 — id do comentário vindo do deep link de notificação (?highlight=). */
  highlightCommentId?: string;
}

/**
 * TASK-048 — container único, reutilizado igual pra série, filme e
 * episódio (só muda o `target` passado por quem usa). A oclusão
 * automática por progresso (`useSpoilerProtection`) só entra quando
 * `episodeSpoilerContext` é passado — comentário de série/filme
 * inteiro continua usando só a flag manual.
 */
export function CommentsSection({ target, episodeSpoilerContext, highlightCommentId }: CommentsSectionProps) {
  const { data: comments = [], isLoading } = useComments(target);
  const { data: currentUser } = useCurrentUser();
  const postComment = usePostComment(target);
  const editComment = useEditComment(target);
  const deleteComment = useDeleteComment(target);

  const spoilerProtection = useSpoilerProtection(
    episodeSpoilerContext?.seriesId ?? 0,
    episodeSpoilerContext?.seasonNumber ?? 0,
    episodeSpoilerContext?.episodeNumber ?? 0
  );
  const autoHide = Boolean(episodeSpoilerContext) && spoilerProtection.shouldHideByDefault;

  const tree = useMemo(() => buildTree(comments), [comments]);
  const isMutating = postComment.isPending || editComment.isPending || deleteComment.isPending;

  function renderNode(node: CommentNode, depth: number): React.ReactNode {
    const hidden = node.containsSpoiler || autoHide;
    return (
      <CommentItem
        key={node.id}
        comment={{ ...node, containsSpoiler: hidden }}
        depth={depth}
        currentUserId={currentUser?.id}
        isMutating={isMutating}
        isHighlighted={node.id === highlightCommentId}
        onReply={(parentId, body, containsSpoiler) => postComment.mutate({ body, parentCommentId: parentId, containsSpoiler })}
        onEdit={(commentId, body, containsSpoiler) => editComment.mutate({ commentId, body, containsSpoiler })}
        onDelete={(commentId) => deleteComment.mutate(commentId)}
      >
        {node.children.length > 0 && node.children.map((child) => renderNode(child, depth + 1))}
      </CommentItem>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-3">
        <CommentComposer
          onSubmit={(body, containsSpoiler) => postComment.mutate({ body, containsSpoiler })}
          isPending={postComment.isPending}
        />
      </div>

      {isLoading ? (
        <p className="text-center text-xs text-muted">Carregando comentários...</p>
      ) : tree.length === 0 ? (
        <EmptyState message="Nenhum comentário ainda. Seja o primeiro a comentar." />
      ) : (
        <div className="space-y-4">{tree.map((node) => renderNode(node, 0))}</div>
      )}
    </div>
  );
}
