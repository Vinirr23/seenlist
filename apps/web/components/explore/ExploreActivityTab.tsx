"use client";

import Link from "next/link";
import Image from "next/image";
import { useActivityFeed } from "@/lib/queries/activity-feed";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { PageError } from "../media/PageError";
import { Avatar } from "../common/Avatar";

export function ExploreActivityTab() {
  const { data, isLoading, isError, refetch } = useActivityFeed();
  const { t, locale } = useTranslation();
  const timeFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 pt-4" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <PageError message={t("explore.errorLoadActivity")} onRetry={() => refetch()} />;
  }

  // CORREÇÃO (a pedido — Fase E, 2026-08-22) — o feed agora só mostra
  // quem você segue (ver `activity-feed.ts`); `followingCount === 0`
  // distingue "você ainda não segue ninguém" (mensagem própria, mais
  // clara) de "quem você segue não teve atividade nos últimos 7 dias"
  // (a mensagem genérica de sempre).
  if (!data || data.items.length === 0) {
    const message = !data || data.followingCount === 0 ? t("explore.emptyActivityNoFollows") : t("explore.emptyActivity");
    return <p className="px-4 pt-6 text-center text-sm text-muted">{message}</p>;
  }

  return (
    <div className="space-y-2 px-4 pt-2">
      {data.items.map((item) => {
        const href = item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`;
        const posterUrl = tmdbImage(item.mediaPosterPath, "w185");
        return (
          // "Vidro" (a pedido — mesmo padrão do Perfil) — antes era uma
          // lista lisa (`border-b border-border`, sem card nenhum).
          // Virou "glass-row" (mesmo estilo de ProfileRecommendationsPreview.tsx).
          <Link
            key={item.id}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-white/10 px-3.5 py-3 backdrop-blur-[18px] backdrop-saturate-[180%] transition-colors hover:border-primary/40"
            style={{
              background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
            }}
          >
            {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
            <Avatar src={item.userAvatarUrl} name={item.userName} className="h-9 w-9 bg-surface" textClassName="text-xs" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">
                <span className="font-semibold">{item.userName}</span> {item.action}{" "}
                <span className="font-semibold">{item.mediaTitle}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{timeFormatter.format(new Date(item.createdAt))}</p>
            </div>
            {posterUrl && (
              <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-surface">
                <Image src={posterUrl} alt="" fill sizes="32px" loading="lazy" className="object-cover" />
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
