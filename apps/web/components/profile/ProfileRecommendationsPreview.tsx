"use client";

import Link from "next/link";
import Image from "next/image";
import { Send } from "lucide-react";
import { useReceivedRecommendations } from "@/lib/queries/recommendations";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * TASK-178 — "Recomendações" deixa de ser só "0 >" e ganha prévia de
 * verdade: avatares de quem recomendou (sobrepostos, mais recente
 * primeiro) + a recomendação mais recente em destaque (pôster +
 * "Fulano recomendou 'Título' pra você"). Mesmo dado que a tela
 * `/profile/recommendations` já usa (`useReceivedRecommendations`),
 * sem buscar nada novo.
 */
export function ProfileRecommendationsPreview() {
  const { data: recommendations, isLoading } = useReceivedRecommendations();

  if (isLoading) {
    return (
      <Link href="/profile/recommendations" className="mb-2 block h-20 animate-pulse rounded-lg bg-surface" />
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Link
        href="/profile/recommendations"
        className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/40"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12">
          <Send className="h-4 w-4 text-primary" strokeWidth={2} />
        </span>
        <span className="text-sm font-medium text-text">Recomendações</span>
        <span className="ml-auto text-xs text-muted">Nenhuma ainda</span>
      </Link>
    );
  }

  const latest = recommendations[0]!;
  const uniqueSenders = [...new Map(recommendations.map((r) => [r.sender.userId, r.sender])).values()].slice(0, 4);
  const posterUrl = tmdbImage(latest.posterPath, "w185");
  const unreadCount = recommendations.filter((r) => !r.readAt).length;

  return (
    <Link
      href="/profile/recommendations"
      className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/40"
    >
      <div className="flex shrink-0 -space-x-3">
        {uniqueSenders.map((sender) => (
          <div key={sender.userId} className="h-8 w-8 overflow-hidden rounded-full border-2 border-surface bg-background">
            {sender.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image (mesmo padrão de ProfileHeader.tsx)
              <img src={sender.avatarUrl} alt={sender.displayName ?? sender.username} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted">
                {(sender.displayName ?? sender.username).slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">
          <span className="font-semibold">{latest.sender.displayName ?? latest.sender.username}</span> recomendou{" "}
          <span className="font-semibold">&quot;{latest.title}&quot;</span> pra você
        </p>
        {unreadCount > 0 && <p className="text-xs text-primary">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</p>}
      </div>

      {posterUrl && (
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-background">
          <Image src={posterUrl} alt={latest.title} fill sizes="40px" className="object-cover" />
        </div>
      )}
    </Link>
  );
}
