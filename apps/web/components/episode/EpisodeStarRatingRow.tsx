"use client";

import { Star } from "lucide-react";
import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const LEVEL_VALUES = [1, 2, 3, 4, 5];

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
  const { t } = useTranslation();
  const labels: Record<number, string> = {
    1: t("episode.rating.bad"),
    2: t("episode.rating.ok"),
    3: t("episode.rating.good"),
    4: t("episode.rating.great"),
    5: t("episode.rating.wow"),
  };

  return (
    <div className="flex justify-between gap-1">
      {LEVEL_VALUES.map((levelValue) => {
        const filled = value >= levelValue;
        return (
          <button
            key={levelValue}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(levelValue);
            }}
            className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 transition-colors hover:bg-surface"
          >
            <Star
              className={cn("h-6 w-6", filled ? "fill-primary text-primary" : "text-muted")}
              strokeWidth={2}
            />
            <span className={cn("text-[10px] font-bold tracking-wide", filled ? "text-primary" : "text-muted")}>
              {labels[levelValue]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
