"use client";

import { Heart } from "lucide-react";
import type { MediaType } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { useIsFavorite, useToggleFavorite } from "@/lib/queries/favorites";

export function FavoriteButton({ mediaType, mediaId }: { mediaType: MediaType; mediaId: number }) {
  const { data: isFavorite } = useIsFavorite(mediaType, mediaId);
  const toggle = useToggleFavorite(mediaType, mediaId);

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={Boolean(isFavorite)}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(Boolean(isFavorite))}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border transition-transform active:scale-[0.96] disabled:opacity-50"
    >
      <Heart className={cn("h-4 w-4", isFavorite ? "fill-danger text-danger" : "text-muted")} strokeWidth={2} />
    </button>
  );
}
