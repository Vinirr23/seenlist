"use client";

import { Heart } from "lucide-react";
import type { PostComment } from "@/lib/queries/post-comments";
import { useHasLiked, useLikeCount, useToggleLike } from "@/lib/queries/social/likes";
import { cn } from "@seenlist/utils";

interface CommentNode extends PostComment {
  children: CommentNode[];
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export function PostCommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: CommentNode;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  const { data: hasLiked } = useHasLiked("post_comment", comment.id);
  const { data: likeCount } = useLikeCount("post_comment", comment.id);
  const toggleLike = useToggleLike("post_comment", comment.id);

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-3" : ""}>
      <div className="py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-text">{comment.authorName}</p>
          <p className="text-xs text-muted">{dateFormatter.format(new Date(comment.createdAt))}</p>
        </div>
        <p className="mt-0.5 text-sm text-text">{comment.body}</p>
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggleLike.mutate(Boolean(hasLiked))}
            className={cn("flex items-center gap-1 text-xs", hasLiked ? "text-primary" : "text-muted")}
          >
            <Heart className="h-3.5 w-3.5" strokeWidth={2} fill={hasLiked ? "currentColor" : "none"} />
            {likeCount ?? 0}
          </button>
          {depth < 2 && (
            <button type="button" onClick={() => onReply(comment.id)} className="text-xs text-muted">
              Responder
            </button>
          )}
        </div>
      </div>
      {comment.children.map((child) => (
        <PostCommentItem key={child.id} comment={child} depth={depth + 1} onReply={onReply} />
      ))}
    </div>
  );
}

export function buildPostCommentTree(comments: PostComment[]): CommentNode[] {
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
