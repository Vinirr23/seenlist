"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MoreHorizontal } from "lucide-react";
import type { MyComment } from "@/lib/queries/my-comments";
import { useDeleteComment } from "@/lib/queries/social/comments";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/**
 * TASK-056 — cada comentário aqui pode pertencer a uma mídia
 * diferente (série X, filme Y, episódio Z) — por isso cada linha é
 * seu PRÓPRIO componente: `useDeleteComment` precisa do `target`
 * certo pra essa linha específica, e isso não dá pra fazer chamando
 * o hook dentro de um `.map()` de um componente só (regra dos
 * hooks). Mesmo padrão já usado em ContinueWatchingCard.
 */
export function MyCommentRow({ comment }: { comment: MyComment }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const deleteComment = useDeleteComment({
    mediaType: comment.mediaType,
    mediaId: comment.mediaId,
    seasonNumber: comment.seasonNumber ?? undefined,
    episodeNumber: comment.episodeNumber ?? undefined,
  });

  const posterUrl = tmdbImage(comment.mediaPosterPath, "w185");
  const episodeCode =
    comment.seasonNumber != null && comment.episodeNumber != null
      ? `T${comment.seasonNumber} · E${comment.episodeNumber}`
      : null;

  function handleDelete() {
    hapticTick();
    deleteComment.mutate(comment.id);
    setMenuOpen(false);
  }

  return (
    <div className="relative border-b border-border px-4 py-3">
      <Link href={comment.targetUrl} className="flex gap-3">
        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-surface">
          {posterUrl && <Image src={posterUrl} alt="" fill sizes="44px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted">
            {comment.mediaTitle}
            {episodeCode ? ` · ${episodeCode}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">{dateFormatter.format(new Date(comment.createdAt))}</p>
          <p className="mt-1 line-clamp-3 text-sm text-text">
            {comment.containsSpoiler ? "Contém spoiler — toque para ver" : comment.body}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Mais opções"
        className="absolute right-3 top-3 p-1 text-muted hover:text-text"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>

      {menuOpen && (
        <div className="absolute right-3 top-9 z-10 min-w-[140px] rounded-lg border border-border bg-surface py-1 shadow-lg">
          <Link
            href={comment.targetUrl}
            className="block px-3 py-1.5 text-left text-xs text-text hover:bg-background"
            onClick={() => setMenuOpen(false)}
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="block w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-background"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
