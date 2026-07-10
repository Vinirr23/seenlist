"use client";

import { useEffect, useState } from "react";
import { HalfStarRating } from "./HalfStarRating";
import { hapticTick } from "@/lib/haptics";

export interface EpisodeRatingBottomSheetProps {
  onSubmit: (rating: number) => void;
  onDismiss: () => void;
  isPending?: boolean;
}

/**
 * TASK-056 — "Como você avaliaria este episódio?", aberto
 * automaticamente na primeira vez que o episódio é marcado como
 * assistido. Mesmo padrão visual de sheet (backdrop + slide-up) já
 * usado em `WatchedActionsBottomSheet` — reaproveitado, não
 * reinventado.
 */
export function EpisodeRatingBottomSheet({ onSubmit, onDismiss, isPending }: EpisodeRatingBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose(callback: () => void) {
    setMounted(false);
    setTimeout(callback, 200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
        onClick={() => handleClose(onDismiss)}
        aria-hidden="true"
      />

      <div
        className={`relative w-full max-w-[430px] rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
          mounted ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden="true" />

        <p className="mb-4 text-center text-sm font-medium text-text">Como você avaliaria este episódio?</p>

        <div className="mb-5 flex justify-center">
          <HalfStarRating value={rating} onChange={setRating} size="lg" />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleClose(onDismiss)}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-text"
          >
            Agora não
          </button>
          <button
            type="button"
            disabled={rating === 0 || isPending}
            onClick={() => {
              hapticTick();
              onSubmit(rating);
              handleClose(() => {});
            }}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
