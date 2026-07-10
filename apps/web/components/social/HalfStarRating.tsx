"use client";

import { Star } from "lucide-react";

/**
 * TASK-056 — avaliação rápida de episódio precisa de meio-passo
 * (0 a 5, incrementos de 0,5), diferente da review completa de
 * série/filme (`StarRating`, inteiro 1-5). Em vez de forçar o
 * componente existente a virar dois modos diferentes, criei este —
 * mais simples reaproveitar a MESMA ideia (estrelas + fill) num
 * componente pequeno e separado do que ramificar o outro com uma
 * flag "meioPasso?".
 */
export function HalfStarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const isInput = Boolean(onChange);
  const starSize = size === "lg" ? "h-9 w-9" : size === "sm" ? "h-4 w-4" : "h-6 w-6";

  function handleClick(starIndex: number, event: React.MouseEvent<HTMLButtonElement>) {
    if (!onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clickedLeftHalf = event.clientX - rect.left < rect.width / 2;
    const newValue = clickedLeftHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(newValue);
  }

  return (
    <div className="flex items-center gap-0.5" role={isInput ? "radiogroup" : undefined} aria-label="Nota de 0 a 5">
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillAmount = Math.max(0, Math.min(1, value - starIndex));
        return (
          <button
            key={starIndex}
            type="button"
            disabled={!isInput}
            onClick={(e) => handleClick(starIndex, e)}
            className={isInput ? "relative p-0.5 active:scale-90 transition-transform" : "relative p-0.5"}
            aria-label={`${starIndex + 1} estrela${starIndex > 0 ? "s" : ""}`}
          >
            <Star className={`${starSize} text-border`} strokeWidth={1.5} />
            {fillAmount > 0 && (
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${fillAmount * 100}%` }}>
                <Star className={`${starSize} fill-primary text-primary`} strokeWidth={1.5} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
