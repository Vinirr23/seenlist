"use client";

import { Heart } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useLikeCount, useHasLiked, useToggleLike } from "@/lib/queries/social/likes";
import type { LikeTargetType } from "@/lib/queries/social/types";
import { hapticTick } from "@/lib/haptics";

/**
 * TASK-048 — "curtidas apenas em comentários e reviews". Um botão
 * só, parametrizado por `targetType`/`targetId` — a tabela `likes`
 * já é genérica (TASK-031), este componente só reflete isso na UI.
 */
export function LikeButton({
  targetType,
  targetId,
  initial,
}: {
  targetType: LikeTargetType;
  targetId: string;
  /** AUDITORIA (perf) — quando quem chama já buscou isso em lote (CommentsSection/ReviewsSection), passa pronto aqui, evitando 2 consultas de rede próprias por instância. */
  initial?: { count: number; hasLiked: boolean };
}) {
  const { data: count = 0 } = useLikeCount(targetType, targetId, initial?.count);
  const { data: hasLiked = false } = useHasLiked(targetType, targetId, initial?.hasLiked);
  const toggleLike = useToggleLike(targetType, targetId);

  return (
    <button
      type="button"
      disabled={toggleLike.isPending}
      aria-pressed={hasLiked}
      onClick={() => {
        hapticTick();
        toggleLike.mutate(hasLiked);
      }}
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors disabled:opacity-50",
        hasLiked ? "text-danger" : "text-muted hover:text-text"
      )}
    >
      <Heart className="h-3.5 w-3.5" strokeWidth={2} fill={hasLiked ? "currentColor" : "none"} />
      {count > 0 && count}
    </button>
  );
}
