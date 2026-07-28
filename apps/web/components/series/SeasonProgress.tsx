import { ProgressBar } from "../media/ProgressBar";
import { barColorClassToTextColorClass } from "@/lib/series-categories";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface SeasonProgressProps {
  watchedCount: number;
  totalEpisodes: number;
  colorClass?: string;
}

/**
 * Equivalente de temporada do <ProgressCard> (progresso da série
 * inteira) — mesma lógica de porcentagem, mesma <ProgressBar>
 * compartilhada, só mais compacto pra caber no cabeçalho do
 * accordion.
 */
export function SeasonProgress({ watchedCount, totalEpisodes, colorClass }: SeasonProgressProps) {
  const percentage = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const { t } = useTranslation();

  return (
    <div className="mt-1.5 w-full">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{t("seriesHome.episodeProgress", { watched: watchedCount, total: totalEpisodes })}</span>
        <span className={colorClass ? barColorClassToTextColorClass(colorClass) : undefined}>{percentage}%</span>
      </div>
      <ProgressBar percentage={percentage} colorClass={colorClass} />
    </div>
  );
}
