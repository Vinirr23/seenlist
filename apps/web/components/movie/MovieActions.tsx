"use client";

import { Check, Plus, Play } from "lucide-react";
import type { MovieWatchStatus } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { useMovieStatus, useSetMovieStatus } from "@/lib/queries/movie-status";

const OPTIONS: { status: MovieWatchStatus; label: string; icon: typeof Check }[] = [
  { status: "watched", label: "Assistido", icon: Check },
  { status: "want_to_watch", label: "Quero assistir", icon: Plus },
  { status: "watching", label: "Assistindo", icon: Play },
];

export function MovieActions({ movieId }: { movieId: number }) {
  const { data: currentStatus } = useMovieStatus(movieId);
  const setStatus = useSetMovieStatus(movieId);

  return (
    <div className="flex gap-2">
      {OPTIONS.map(({ status, label, icon: Icon }) => {
        const active = currentStatus === status;
        return (
          <button
            key={status}
            type="button"
            disabled={setStatus.isPending}
            aria-pressed={active}
            onClick={() =>
              setStatus.mutate({ status, currentStatus: currentStatus ?? null })
            }
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:border-primary/50 hover:text-text"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
