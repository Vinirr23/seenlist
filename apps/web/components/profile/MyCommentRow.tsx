"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MoreHorizontal } from "lucide-react";
import type { MyComment } from "@/lib/queries/my-comments";
import { useDeleteComment } from "@/lib/queries/social/comments";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

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
  const { t, locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short", year: "numeric" });
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
    // "Vidro" (redesign âmbar/vidro, 2026-08-26) — virou "glass-row" (mesmo padrão de ExploreActivityTab.tsx/ProfileSectionRow.tsx), em vez de linha lisa com `border-b`.
    <div
      className="relative rounded-2xl border border-white/10 p-3 backdrop-blur-[18px] backdrop-saturate-[180%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
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
            {comment.containsSpoiler ? t("profile.commentSpoilerGate") : comment.body}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t("feed.moreOptions")}
        className="absolute right-3 top-3 p-1 text-muted hover:text-text"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>

      {menuOpen && (
        // "Vidro" (redesign âmbar/vidro, 2026-08-26) — mesmo painel escuro translúcido do dropdown de histórico do SearchBar.tsx/ConfirmDialog.tsx.
        <div
          className="absolute right-3 top-9 z-10 min-w-[140px] rounded-xl border border-white/10 py-1 shadow-lg backdrop-blur-[18px] backdrop-saturate-[180%]"
          style={{
            background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)",
          }}
        >
          <Link
            href={comment.targetUrl}
            className="block px-3 py-1.5 text-left text-xs text-text hover:bg-white/10"
            onClick={() => setMenuOpen(false)}
          >
            {t("common.edit")}
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="block w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-white/10"
          >
            {t("common.delete")}
          </button>
        </div>
      )}
    </div>
  );
}
