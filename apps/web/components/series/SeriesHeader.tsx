"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Star } from "lucide-react";
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
 * A PEDIDO — refinamento da aba Sobre, item 1 (hero): banner um
 * pouco mais alto (h-64 → h-72), gradiente mais alto e mais suave
 * (integra melhor com o fundo escuro do resto da tela, em vez de
 * cortar seco), título maior (text-xl → text-2xl), e uma segunda
 * linha com nota da comunidade + quantidade de avaliações — "★ 4.8 •
 * 183 mil avaliações" — antes da linha de ano/temporadas que já
 * existia. Nada de excesso: só essas duas linhas, como pedido.
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
  const { t, locale } = useTranslation();
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const backdropUrl = tmdbImage(series.backdropPath, "w1280");
  const year = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;

  const showProgress = totalEpisodes != null && totalEpisodes > 0 && watchedCount != null;
  const percentage = showProgress ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const seasonsLabel = t("series.seasonsCount", {
    count: series.numberOfSeasons,
    plural: series.numberOfSeasons === 1 ? "" : "s",
  });
  const voteCountLabel =
    series.voteCount > 0 ? new Intl.NumberFormat(locale, { notation: "compact" }).format(series.voteCount) : null;

  return (
    <div className="relative h-72 w-full bg-surface">
      {backdropUrl && <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" priority />}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/10" />

      {/* "Vidro" (mesmo padrão dos ícones de editar/configurações do Perfil, ProfileHeader.tsx) — círculo com borda clara + blur/saturação + brilho num canto, em vez de `bg-background/70 backdrop-blur` chapado. */}
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t("common.back")}
        className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text shadow-lg shadow-black/25 backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90"
        style={{
          background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
        }}
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
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text shadow-lg shadow-black/25 backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90"
        style={{
          background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
        }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
      </button>

      <div className={`absolute inset-x-4 ${showProgress ? "bottom-7" : "bottom-3"}`}>
        <h1 className="text-2xl font-extrabold leading-tight text-white drop-shadow">{series.title}</h1>
        {series.voteAverage > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-white/90 drop-shadow">
            <Star className="h-3 w-3 fill-primary text-primary" strokeWidth={0} />
            <span className="font-semibold">{series.voteAverage.toFixed(1)}</span>
            {voteCountLabel && <span className="text-white/70">• {t("series.ratingsCount", { count: voteCountLabel })}</span>}
          </p>
        )}
        <p className="mt-1 text-xs text-white/80 drop-shadow">{[year, seasonsLabel].filter(Boolean).join(" · ")}</p>
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
          currentStatus={currentStatus ?? null}
          onClose={() => setShowMoreOptions(false)}
        />
      )}
    </div>
  );
}
