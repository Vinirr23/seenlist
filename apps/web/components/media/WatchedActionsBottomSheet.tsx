"use client";

import { useEffect, useState } from "react";
import { Eye, Repeat } from "lucide-react";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface WatchedActionsTarget {
  onUnwatch: () => void;
  onRewatch: () => void;
}

export interface WatchedActionsBottomSheetProps {
  target: WatchedActionsTarget;
  onClose: () => void;
}

/**
 * TASK-047 — mesmo padrão do TV Time ao tocar num item já assistido:
 * "Marcar como..." com "Não assistido" e "Reassistido". Um componente
 * só, reutilizável pra episódio, filme e (no futuro) temporada — quem
 * chama só passa o QUE fazer em cada opção (`onUnwatch`/`onRewatch`),
 * este componente não sabe nada sobre séries/filmes/temporadas.
 *
 * Visual: mesmo backdrop + slide-up de baixo já usado em
 * SeriesQuickActionsSheet (fixed inset-0, bg-black/60, rounded-t-2xl)
 * — não é um Alert nativo, é o mesmo padrão de sheet já estabelecido
 * no projeto. Toque fora fecha (onClick no backdrop). Animação:
 * translate-y disparada só depois do mount, pra deslizar de baixo em
 * vez de aparecer já no lugar.
 */
export function WatchedActionsBottomSheet({ target, onClose }: WatchedActionsBottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleClose() {
    setMounted(false);
    setTimeout(onClose, 200);
  }

  function handleUnwatch() {
    hapticTick();
    target.onUnwatch();
    handleClose();
  }

  function handleRewatch() {
    hapticTick();
    target.onRewatch();
    handleClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* "Vidro" (mesmo padrão do dropdown de histórico do SearchBar.tsx) */}
      <div
        className={`relative w-full max-w-[430px] rounded-t-2xl border-t border-white/10 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-[18px] backdrop-saturate-[180%] transition-transform duration-200 ease-out ${
          mounted ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)",
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />

        <p className="px-4 pb-2 pt-3 text-center text-sm font-medium text-muted">{t("media.markAs")}</p>

        <div className="border-t border-border">
          <button
            type="button"
            onClick={handleUnwatch}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-text transition-colors active:bg-background"
          >
            <Eye className="h-5 w-5 text-muted" strokeWidth={2} />
            {t("episode.notWatched")}
          </button>
          <button
            type="button"
            onClick={handleRewatch}
            className="flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left text-sm text-text transition-colors active:bg-background"
          >
            <Repeat className="h-5 w-5 text-muted" strokeWidth={2} />
            {t("media.rewatched")}
          </button>
        </div>
      </div>
    </div>
  );
}
