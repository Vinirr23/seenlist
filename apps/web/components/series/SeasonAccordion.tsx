"use client";

import { useState } from "react";
import { ChevronDown, CheckCircle2, Circle } from "lucide-react";
import type { SeasonWithEpisodes } from "@seenlist/types";
import { cn } from "@seenlist/utils";
import { EpisodeCard } from "./EpisodeCard";
import { SeasonProgress } from "./SeasonProgress";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "../search/EmptyState";
import { InlineError } from "../media/InlineError";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { barColorClassToTextColorClass } from "@/lib/series-categories";
import {
  isEpisodeWatched,
  useToggleEpisodeWatched,
  useMarkEpisodesWatched,
  useUnmarkSeasonWatched,
  useIncrementEpisodeRewatch,
  type WatchedEpisodeKey,
} from "@/lib/queries/watched-episodes";
import { WatchedActionsBottomSheet } from "../media/WatchedActionsBottomSheet";

export interface SeasonAccordionProps {
  seriesId: number;
  season: SeasonWithEpisodes;
  watchedEpisodes: Set<WatchedEpisodeKey> | undefined;
  defaultOpen?: boolean;
  colorClass?: string;
}

type PendingDialog = { type: "mark-previous"; episodeNumber: number } | { type: "season-toggle" } | null;

/**
 * TASK-025 — marcação inteligente. Três mutations em jogo:
 * `useToggleEpisodeWatched` (um episódio, comportamento de sempre),
 * `useMarkEpisodesWatched` (vários de uma vez — anteriores, ou
 * temporada inteira) e `useUnmarkSeasonWatched` (desmarcar a
 * temporada inteira). Cada uma delas já invalida a Biblioteca
 * também (ver watched-episodes-mutations.ts), então progresso da
 * temporada, da série, estatísticas do Perfil e categorias da
 * Biblioteca atualizam sozinhos, sem esta tela precisar saber disso.
 */
export function SeasonAccordion({
  seriesId,
  season,
  watchedEpisodes,
  defaultOpen = false,
  colorClass = "bg-primary",
}: SeasonAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [watchedActionsEpisode, setWatchedActionsEpisode] = useState<number | null>(null);
  const toast = useToast();

  const toggleWatched = useToggleEpisodeWatched(seriesId);
  const markEpisodes = useMarkEpisodesWatched(seriesId);
  const unmarkSeason = useUnmarkSeasonWatched(seriesId);
  const incrementRewatch = useIncrementEpisodeRewatch(seriesId);

  const watchedCount = season.episodes.filter((episode) =>
    isEpisodeWatched(watchedEpisodes, episode.seasonNumber, episode.episodeNumber)
  ).length;
  const allWatched = season.episodes.length > 0 && watchedCount === season.episodes.length;
  const isBusy = toggleWatched.isPending || markEpisodes.isPending || unmarkSeason.isPending;

  function handleEpisodeToggle(episodeNumber: number, currentlyWatched: boolean) {
    if (currentlyWatched) {
      // TASK-047 — igual TV Time: tocar num episódio já assistido não desmarca direto, abre o "Marcar como...".
      hapticTick();
      setWatchedActionsEpisode(episodeNumber);
      return;
    }
    hapticTick();

    const hasUnwatchedBefore = season.episodes.some(
      (episode) =>
        episode.episodeNumber < episodeNumber &&
        !isEpisodeWatched(watchedEpisodes, episode.seasonNumber, episode.episodeNumber)
    );

    if (hasUnwatchedBefore) {
      setDialog({ type: "mark-previous", episodeNumber });
    } else {
      toggleWatched.mutate(
        { seasonNumber: season.seasonNumber, episodeNumber, watched: false },
        {
          onSuccess: () => toast.success("Episódio marcado"),
          onError: () => toast.error("Erro de conexão"),
        }
      );
    }
  }

  function markUpToEpisode(episodeNumber: number) {
    const episodes = season.episodes
      .filter((episode) => episode.episodeNumber <= episodeNumber)
      .map((episode) => ({ seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber }));
    markEpisodes.mutate(episodes, {
      onSuccess: () => toast.success("Episódio marcado"),
      onError: () => toast.error("Erro de conexão"),
    });
    setDialog(null);
  }

  function markOnlyThisEpisode(episodeNumber: number) {
    toggleWatched.mutate(
      { seasonNumber: season.seasonNumber, episodeNumber, watched: false },
      { onSuccess: () => toast.success("Episódio marcado"), onError: () => toast.error("Erro de conexão") }
    );
    setDialog(null);
  }

  function handleSeasonButtonClick(event: React.MouseEvent) {
    event.stopPropagation();
    setDialog({ type: "season-toggle" });
  }

  function confirmSeasonToggle() {
    hapticTick();
    if (allWatched) {
      unmarkSeason.mutate(season.seasonNumber, { onError: () => toast.error("Erro de conexão") });
    } else {
      markEpisodes.mutate(
        season.episodes.map((episode) => ({
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
        })),
        {
          onSuccess: () => toast.success("Temporada concluída"),
          onError: () => toast.error("Erro de conexão"),
        }
      );
    }
    setDialog(null);
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">{season.name}</p>
            <SeasonProgress watchedCount={watchedCount} totalEpisodes={season.episodes.length} colorClass={colorClass} />
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
            strokeWidth={2}
          />
        </button>

        {season.episodes.length > 0 && (
          <button
            type="button"
            onClick={handleSeasonButtonClick}
            disabled={isBusy}
            aria-label={allWatched ? "Desmarcar temporada" : "Marcar temporada como assistida"}
            className="shrink-0 text-muted transition-colors hover:text-primary disabled:opacity-50"
          >
            {allWatched ? (
              <CheckCircle2 className={cn("h-6 w-6", barColorClassToTextColorClass(colorClass))} strokeWidth={2} />
            ) : (
              <Circle className="h-6 w-6" strokeWidth={2} />
            )}
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-2 border-t border-border p-3">
          <InlineError show={toggleWatched.isError || markEpisodes.isError || unmarkSeason.isError} />
          {season.episodes.length === 0 ? (
            <EmptyState message="Nenhum episódio encontrado para esta temporada." />
          ) : (
            season.episodes.map((episode) => {
              const watched = isEpisodeWatched(watchedEpisodes, episode.seasonNumber, episode.episodeNumber);
              return (
                <EpisodeCard
                  key={episode.id}
                  seriesId={seriesId}
                  episode={episode}
                  watched={watched}
                  pending={isBusy}
                  colorClass={colorClass}
                  onToggleWatched={() => handleEpisodeToggle(episode.episodeNumber, watched)}
                />
              );
            })
          )}
        </div>
      )}

      {dialog?.type === "mark-previous" && (
        <ConfirmDialog
          title="Marcar episódios anteriores?"
          message="Você deseja marcar também todos os episódios anteriores como assistidos?"
          onDismiss={() => setDialog(null)}
          actions={[
            { label: "Sim", variant: "primary", onClick: () => markUpToEpisode(dialog.episodeNumber) },
            { label: "Não", variant: "default", onClick: () => markOnlyThisEpisode(dialog.episodeNumber) },
            { label: "Cancelar", variant: "default", onClick: () => setDialog(null) },
          ]}
        />
      )}

      {dialog?.type === "season-toggle" && (
        <ConfirmDialog
          title={allWatched ? "Desmarcar toda a temporada?" : "Marcar temporada como assistida?"}
          message={
            allWatched
              ? "Todos os episódios desta temporada voltarão para não assistido."
              : "Todos os episódios desta temporada serão marcados como assistidos."
          }
          onDismiss={() => setDialog(null)}
          actions={[
            {
              label: allWatched ? "Desmarcar" : "Marcar",
              variant: allWatched ? "danger" : "primary",
              onClick: confirmSeasonToggle,
            },
            { label: "Cancelar", variant: "default", onClick: () => setDialog(null) },
          ]}
        />
      )}

      {watchedActionsEpisode !== null && (
        <WatchedActionsBottomSheet
          target={{
            onUnwatch: () => {
              toggleWatched.mutate(
                { seasonNumber: season.seasonNumber, episodeNumber: watchedActionsEpisode, watched: true },
                { onError: () => toast.error("Erro de conexão") }
              );
            },
            onRewatch: () => {
              incrementRewatch.mutate(
                { seasonNumber: season.seasonNumber, episodeNumber: watchedActionsEpisode },
                {
                  onSuccess: () => toast.success("Reassistido"),
                  onError: () => toast.error("Erro de conexão"),
                }
              );
            },
          }}
          onClose={() => setWatchedActionsEpisode(null)}
        />
      )}
    </div>
  );
}
