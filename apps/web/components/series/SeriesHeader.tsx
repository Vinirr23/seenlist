"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import type { SeriesDetails, LibraryStatus } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { SeriesQuickActionsSheet } from "../profile/SeriesQuickActionsSheet";

export interface SeriesHeaderProps {
  series: SeriesDetails;
  seriesId: number;
  seriesTitle: string;
  currentStatus: LibraryStatus | null | undefined;
  /** TASK-053 — mesmos dados que o antigo ProgressCard usava; cálculo de porcentagem idêntico, só mudou onde renderiza. */
  watchedCount?: number;
  totalEpisodes?: number;
  colorClass?: string;
}

/**
 * TASK-053 (correção) — hierarquia igual ao TV Time: título e
 * metadados ficam DENTRO do banner (sobre a própria imagem, sem
 * cartão de pôster separado flutuando por cima), e a barra de
 * progresso fica colada na borda inferior da imagem, abaixo do
 * texto — nunca como um bloco à parte entre a capa e o conteúdo.
 *
 * Tradução (5º lote).
 */
export function SeriesHeader({
  series,
  seriesId,
  seriesTitle,
  currentStatus,
  watchedCount,
  totalEpisodes,
  colorClass = "bg-primary",
}: SeriesHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const backdropUrl = tmdbImage(series.backdropPath, "w1280");
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;

  const showProgress = totalEpisodes != null && totalEpisodes > 0 && watchedCount != null;
  const percentage = showProgress ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const seasonsLabel = t("series.seasonsCount", {
    count: series.numberOfSeasons,
    plural: series.numberOfSeasons === 1 ? "" : "s",
  });

  return (
    <div className="relative h-64 w-full bg-surface">
      {backdropUrl && <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" priority />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t("common.back")}
        className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <button
        type="button"
        onClick={() => {
          hapticTick();
          setShowMoreOptions(true);
        }}
        aria-label={t("action.moreOptions")}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <div className={`absolute inset-x-4 ${showProgress ? "bottom-7" : "bottom-3"}`}>
        <h1 className="text-xl font-bold leading-tight text-white drop-shadow">{series.title}</h1>
        <p className="mt-1 text-xs text-white/80 drop-shadow">
          {[year, seasonsLabel, series.genres[0]].filter(Boolean).join(" · ")}
        </p>
      </div>

      {showProgress && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
            <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${percentage}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold text-white drop-shadow">{percentage}%</span>
        </div>
      )}

      {showMoreOptions && (
        <SeriesQuickActionsSheet
          seriesId={seriesId}
          seriesTitle={seriesTitle}
          currentStatus={(currentStatus ?? "want_to_watch") as LibraryStatus}
          onClose={() => setShowMoreOptions(false)}
        />
      )}
    </div>
  );
}
