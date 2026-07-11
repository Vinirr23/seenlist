"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Share2, Link2, Pencil, Trash2 } from "lucide-react";
import type { Post } from "@/lib/queries/posts";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useEditPost, useDeletePost } from "@/lib/queries/posts";
import { useHasLiked, useLikeCount, useToggleLike } from "@/lib/queries/social/likes";
import { usePostCommentCount } from "@/lib/queries/post-comments";
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
 *
 * TASK-073 — dois modos:
 * - `detail=false` (padrão, usado no Feed): o card inteiro é
 *   clicável e leva pra `/explore/posts/[id]` — a mesma tela dedicada
 *   que já existia (`PostDetailView`), mostrando só aquele post com
 *   os comentários abertos embaixo, rolando a tela (referência:
 *   Twitter/X). O número de comentários agora aparece sempre, igual
 *   à curtida — não é mais preciso abrir os comentários pra saber
 *   quantos tem (`usePostCommentCount`, contagem leve, sem baixar os
 *   comentários de verdade).
 * - `detail=true` (usado só pela própria tela de detalhe): o card
 *   não navega pra lugar nenhum (já é a página de destino) e os
 *   comentários aparecem sempre abertos, sem precisar tocar em nada.
 *
 * Navegação por clique é `<div onClick>` + `stopPropagation` nos
 * controles internos (curtir, menu "..."), não um `<Link>` em volta
 * de tudo — evitar aninhar botões dentro de `<a>` (o "..." abre um
 * menu com mais botões dentro, que também precisariam propagar o
 * clique corretamente).
 */
export function PostCard({ post, detail = false }: { post: Post; detail?: boolean }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const { data: currentUser } = useCurrentUser();
  const { data: hasLiked } = useHasLiked("post", post.id);
  const { data: likeCount } = useLikeCount("post", post.id);
  const toggleLike = useToggleLike("post", post.id);
  const { data: commentCount } = usePostCommentCount(post.id);
  const { data: isSaved } = useIsSaved(post.id);
  const toggleSave = useToggleSavePost(post.id);
  const reportPost = useReportPost(post.id);
  const editPost = useEditPost(post.id);
  const deletePost = useDeletePost(post.id);
  const toast = useToast();
  const isOwner = currentUser?.id === post.userId;

  function goToDetail() {
    if (detail) return;
    router.push(`/explore/posts/${post.id}`);
  }

  function handleReport() {
    hapticTick();
    reportPost.mutate("inadequado", { onSuccess: () => setReported(true) });
    setMenuOpen(false);
  }

  function handleStartEdit(event: React.MouseEvent) {
    event.stopPropagation();
    hapticTick();
    setEditBody(post.body);
    setEditing(true);
    setMenuOpen(false);
  }

  function handleSaveEdit(event: React.MouseEvent) {
    event.stopPropagation();
    const trimmed = editBody.trim();
    if (!trimmed) return;
    editPost.mutate(trimmed, {
      onSuccess: () => {
        toast.success("Post editado");
        setEditing(false);
      },
    });
  }

  function handleDelete(event: React.MouseEvent) {
    event.stopPropagation();
    hapticTick();
    if (!window.confirm("Apagar este post? Não dá pra desfazer.")) {
      setMenuOpen(false);
      return;
    }
    deletePost.mutate(undefined, {
      onSuccess: () => {
        toast.success("Post apagado");
        if (detail) router.push("/feed");
      },
    });
    setMenuOpen(false);
  }

  async function handleShare(event: React.MouseEvent) {
    event.stopPropagation();
    hapticTick();
    const url = `${window.location.origin}/explore/posts/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "SeenList" });
      } catch {
        // usuário cancelou o menu nativo — não é erro, não precisa de toast
      }
    } else {
      await handleCopyLink(event);
      return;
    }
    setMenuOpen(false);
  }

  async function handleCopyLink(event: React.MouseEvent) {
    event.stopPropagation();
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
    <div
      onClick={goToDetail}
      className={cn("relative rounded-xl border border-border bg-surface p-3", !detail && "cursor-pointer")}
    >
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="Mais opções"
          className="p-1 text-muted"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-10 z-10 min-w-[160px] rounded-lg border border-border bg-background py-1 shadow-lg"
          >
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
            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Apagar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReport();
                }}
                disabled={reported}
                className="block w-full px-3 py-1.5 text-left text-xs text-danger disabled:opacity-50"
              >
                {reported ? "Denunciado" : "Denunciar"}
              </button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <div onClick={(e) => e.stopPropagation()} className="mt-2.5 space-y-2">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            maxLength={500}
            autoFocus
            className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm text-text focus:border-primary focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editBody.trim() || editPost.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        post.body && <p className="mt-2.5 whitespace-pre-wrap text-sm text-text">{post.body}</p>
      )}
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- imagem do usuário no Storage, sem domínio fixo configurado
        <img
          src={post.imageUrl}
          alt=""
          className="mt-2.5 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      )}

      <div className="mt-2.5 flex items-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleLike.mutate(Boolean(hasLiked));
          }}
          className={cn("flex items-center gap-1.5 text-xs", hasLiked ? "text-primary" : "text-muted")}
        >
          <Heart className="h-4 w-4" strokeWidth={2} fill={hasLiked ? "currentColor" : "none"} />
          {likeCount ?? 0}
        </button>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          {commentCount ?? 0}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSave.mutate(Boolean(isSaved));
          }}
          aria-label={isSaved ? "Remover dos salvos" : "Salvar"}
          className={cn("ml-auto flex items-center gap-1.5 text-xs", isSaved ? "text-primary" : "text-muted")}
        >
          <Bookmark className="h-4 w-4" strokeWidth={2} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>

      {detail && (
        <div onClick={(e) => e.stopPropagation()}>
          <PostCommentsSection postId={post.id} />
        </div>
      )}
    </div>
  );
}
