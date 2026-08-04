"use client";

import { Star } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-048 — 1 a 5 estrelas. Um componente só: passando `onChange`
 * vira input (usado no ReviewFullComposer); sem `onChange`, é só
 * exibição (usado no ReviewCard). Evita duplicar a mesma renderização
 * de 5 estrelas em dois lugares.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
}) {
  const isInput = Boolean(onChange);
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-6 w-6";
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-0.5" role={isInput ? "radiogroup" : undefined} aria-label={t("social.rating")}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const StarEl = (
          <Star
            className={cn(starSize, filled ? "fill-primary text-primary" : "text-border")}
            strokeWidth={1.5}
          />
        );
        if (!isInput) {
          return <span key={star}>{StarEl}</span>;
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} ${t("social.star")}${star > 1 ? "s" : ""}`}
            onClick={() => onChange?.(star)}
            className="p-0.5 active:scale-90 transition-transform"
          >
            {StarEl}
          </button>
        );
      })}
    </div>
  );
}
