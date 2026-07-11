"use client";

import { Star } from "lucide-react";
import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";

const LEVELS = [
  { value: 1, label: "RUIM" },
  { value: 2, label: "OK" },
  { value: 3, label: "BOM" },
  { value: 4, label: "ÓTIMO" },
  { value: 5, label: "UAU" },
];

/**
 * TASK-067 — versão de 5 estrelas inteiras com rótulo embaixo de
 * cada uma (RUIM/OK/BOM/ÓTIMO/UAU), como no TV Time. Diferente de
 * `HalfStarRating` (que já existe e continua sendo usado no card
 * "Informações do episódio" pra mostrar a MÉDIA da comunidade, que
 * pode ter casas decimais tipo 4.5 — meia estrela faz sentido lá,
 * não aqui, onde a pessoa está dando a própria nota inteira agora).
 */
export function EpisodeStarRatingRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex justify-between gap-1">
      {LEVELS.map((level) => {
        const filled = value >= level.value;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(level.value);
            }}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-surface"
          >
            <Star
              className={cn("h-6 w-6", filled ? "fill-primary text-primary" : "text-muted")}
              strokeWidth={2}
            />
            <span className={cn("text-[10px] font-bold tracking-wide", filled ? "text-primary" : "text-muted")}>
              {level.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
