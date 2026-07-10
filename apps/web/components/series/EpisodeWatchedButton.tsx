"use client";

import { Check } from "lucide-react";
import { cn } from "@seenlist/utils";

export interface EpisodeWatchedButtonProps {
  watched: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** TASK-060 — cor da categoria atual da série, usada só quando `watched` é true. Decisão revertida explicitamente pelo usuário (antes era sempre branco); não assistido continua sempre branco com check escuro. */
  colorClass?: string;
}

const SIZE_CLASSES: Record<NonNullable<EpisodeWatchedButtonProps["size"]>, { button: string; icon: string }> = {
  sm: { button: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { button: "h-8 w-8", icon: "h-4 w-4" },
  lg: { button: "h-10 w-10", icon: "h-5 w-5" },
};

/**
 * TASK-055 — componente único do botão circular de marcar episódio,
 * reaproveitado por todos os lugares que precisam dele.
 *
 * TASK-060 — correção sobre a TASK-055: "sempre branco" valia só
 * pro estado NÃO assistido. Quando assistido, volta a usar a cor da
 * categoria da série (`colorClass`), decisão explícita do usuário
 * revertendo a escolha anterior.
 */
export function EpisodeWatchedButton({ watched, onClick, disabled, size = "md", className, colorClass = "bg-primary" }: EpisodeWatchedButtonProps) {
  const sizes = SIZE_CLASSES[size];

  return (
    <button
      type="button"
      onClick={(event) => {
        // Esse botão quase sempre fica dentro de um <Link> (linha inteira
        // clicável) — sem isso, clicar nele também navegaria pro episódio.
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-pressed={watched}
      aria-label={watched ? "Marcar como não assistido" : "Marcar como assistido"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full shadow-sm transition-transform active:scale-90 disabled:opacity-50",
        watched ? `${colorClass} text-white` : "bg-white text-black",
        sizes.button,
        className
      )}
    >
      <Check className={sizes.icon} strokeWidth={2.5} />
    </button>
  );
}
