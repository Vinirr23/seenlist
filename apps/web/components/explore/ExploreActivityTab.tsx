"use client";

import Link from "next/link";
import Image from "next/image";
import { useActivityFeed } from "@/lib/queries/activity-feed";
import { tmdbImage } from "@/lib/tmdb/image";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ExploreActivityTab() {
  const { data: items, isLoading, isError } = useActivityFeed();

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
    return <p className="px-4 pt-6 text-center text-sm text-muted">Não foi possível carregar as atividades agora.</p>;
  }

  if (!items || items.length === 0) {
    return <p className="px-4 pt-6 text-center text-sm text-muted">Nenhuma atividade recente.</p>;
  }

  return (
    <div className="pt-2">
      {items.map((item) => {
        const href = item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`;
        const posterUrl = tmdbImage(item.mediaPosterPath, "w185");
        return (
          <Link key={item.id} href={href} className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface">
              {item.userAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo
                <img src={item.userAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-muted">{initials(item.userName)}</span>
              )}
            </div>
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
