"use client";

import { useState } from "react";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Share2, Link2 } from "lucide-react";
import type { Post } from "@/lib/queries/posts";
import { useHasLiked, useLikeCount, useToggleLike } from "@/lib/queries/social/likes";
import { usePostComments } from "@/lib/queries/post-comments";
import { useIsSaved, useToggleSavePost } from "@/lib/queries/saved-posts";
import { useReportPost } from "@/lib/queries/post-reports";
import { useToast } from "@/lib/toast/ToastProvider";
import { PostCommentsSection } from "./PostCommentsSection";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@seenlist/utils";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-059 (fase 4) — salvar e denunciar, reaproveitando as duas
 * tabelas já preparadas na migration aprovada (saved_posts,
 * post_reports). Compartilhar/copiar link ficam pra próxima fase.
 */
export function PostCard({ post }: { post: Post }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const { data: hasLiked } = useHasLiked("post", post.id);
  const { data: likeCount } = useLikeCount("post", post.id);
  const toggleLike = useToggleLike("post", post.id);
  const { data: comments } = usePostComments(commentsOpen ? post.id : "");
  const { data: isSaved } = useIsSaved(post.id);
  const toggleSave = useToggleSavePost(post.id);
  const reportPost = useReportPost(post.id);
  const toast = useToast();

  function handleReport() {
    hapticTick();
    reportPost.mutate("inadequado", { onSuccess: () => setReported(true) });
    setMenuOpen(false);
  }

  async function handleShare() {
    hapticTick();
    const url = `${window.location.origin}/explore/posts/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "SeenList" });
      } catch {
        // usuário cancelou o menu nativo — não é erro, não precisa de toast
      }
    } else {
      await handleCopyLink();
    }
    setMenuOpen(false);
  }

  async function handleCopyLink() {
    hapticTick();
    const url = `${window.location.origin}/explore/posts/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch (error) {
      console.error("[posts] Falha ao copiar link", error);
      toast.error("Não foi possível copiar o link.");
    }
    setMenuOpen(false);
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background">
          {post.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo
            <img src={post.authorAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-muted">{initials(post.authorName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{post.authorName}</p>
          <p className="truncate text-xs text-muted">
            @{post.authorUsername} · {dateFormatter.format(new Date(post.createdAt))}
          </p>
        </div>
        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Mais opções" className="p-1 text-muted">
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
        {menuOpen && (
          <div className="absolute right-3 top-10 z-10 min-w-[160px] rounded-lg border border-border bg-background py-1 shadow-lg">
            <button type="button" onClick={handleShare} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text">
              <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
              Compartilhar
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text"
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
              Copiar link
            </button>
            <button
              type="button"
              onClick={handleReport}
              disabled={reported}
              className="block w-full px-3 py-1.5 text-left text-xs text-danger disabled:opacity-50"
            >
              {reported ? "Denunciado" : "Denunciar"}
            </button>
          </div>
        )}
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-sm text-text">{post.body}</p>

      <div className="mt-2.5 flex items-center gap-4">
        <button
          type="button"
          onClick={() => toggleLike.mutate(Boolean(hasLiked))}
          className={cn("flex items-center gap-1.5 text-xs", hasLiked ? "text-primary" : "text-muted")}
        >
          <Heart className="h-4 w-4" strokeWidth={2} fill={hasLiked ? "currentColor" : "none"} />
          {likeCount ?? 0}
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          {commentsOpen ? (comments?.length ?? "...") : "Comentar"}
        </button>
        <button
          type="button"
          onClick={() => toggleSave.mutate(Boolean(isSaved))}
          aria-label={isSaved ? "Remover dos salvos" : "Salvar"}
          className={cn("ml-auto flex items-center gap-1.5 text-xs", isSaved ? "text-primary" : "text-muted")}
        >
          <Bookmark className="h-4 w-4" strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>

      {commentsOpen && <PostCommentsSection postId={post.id} />}
    </div>
  );
}
