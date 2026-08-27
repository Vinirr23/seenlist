"use client";

import { Plus, Check } from "lucide-react";
import { useSeriesStatus } from "@/lib/queries/series-status-state";
import { useSetSeriesStatus } from "@/lib/queries/series-status-mutations";
import { useMovieStatus } from "@/lib/queries/movie-status-state";
import { useSetMovieStatus } from "@/lib/queries/movie-status-mutations";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface AddToLibraryButtonProps {
  mediaType: "movie" | "series";
  mediaId: number;
  className?: string;
}

/**
 * TASK-058 — botão "+" dos cards de descoberta. Reaproveita
 * useSetSeriesStatus/useSetMovieStatus (já existiam, usados em toda
 * a Biblioteca) — "adicionar" aqui é só marcar como "Assistir
 * depois", a mesma ação que qualquer outro "+" do app já faz.
 */
export function AddToLibraryButton({ mediaType, mediaId, className }: AddToLibraryButtonProps) {
  const seriesStatus = useSeriesStatus(mediaType === "series" ? mediaId : -1);
  const movieStatus = useMovieStatus(mediaType === "movie" ? mediaId : -1);
  const setSeriesStatus = useSetSeriesStatus(mediaId);
  const setMovieStatus = useSetMovieStatus(mediaId);
  const { t } = useTranslation();

  const currentStatus = mediaType === "series" ? seriesStatus.data : movieStatus.data;
  const isAdded = currentStatus != null;
  const isPending = mediaType === "series" ? setSeriesStatus.isPending : setMovieStatus.isPending;

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    hapticTick();
    if (isAdded) return; // já está na biblioteca — "+" não remove, só adiciona (mesmo padrão do TV Time)
    if (mediaType === "series") {
      setSeriesStatus.mutate({ status: "want_to_watch", currentStatus: null });
    } else {
      setMovieStatus.mutate({ status: "want_to_watch", currentStatus: null });
    }
  }

  return (
    // Correção (a pedido — "continua como estava, só coloque um efeito
    // de vidro, mas não é pra deixar ele âmbar") — revertido de volta
    // pro formato/cor original (quadrado levemente arredondado,
    // contorno e ícone âmbar — `border-primary text-primary`, não o
    // "gel" preto do "Ver detalhes"). Só o FUNDO virou vidro de
    // verdade: era `bg-background/80` (chapado, translúcido simples)
    // + `backdrop-blur-sm` (blur fraco); agora tem blur/saturação mais
    // fortes + um leve brilho branco no canto (mesmo princípio dos
    // ícones de vidro sobre a capa em ProfileHeader.tsx), mas o fundo
    // continua escuro/neutro — nada de âmbar aqui.
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isAdded ? t("explore.alreadyInLibrary") : t("explore.addToLibrary")}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded border-2 border-primary text-primary backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90 disabled:opacity-60",
        className
      )}
      style={{
        background: "radial-gradient(65% 65% at 28% 22%, rgba(255,255,255,0.18), transparent 60%), rgba(11,14,20,0.55)",
      }}
    >
      {isAdded ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
    </button>
  );
}
