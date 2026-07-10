import { barColorClassToTextColorClass } from "@/lib/series-categories";

export interface ProgressCardProps {
  watchedCount: number;
  totalEpisodes: number;
  colorClass?: string;
}

export function ProgressCard({ watchedCount, totalEpisodes, colorClass = "bg-primary" }: ProgressCardProps) {
  const percentage = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;
  const textColorClass = barColorClassToTextColorClass(colorClass);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-text">Progresso</p>
        <p className={`text-sm font-semibold ${textColorClass}`}>{percentage}%</p>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${colorClass} transition-all`} style={{ width: `${percentage}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {watchedCount} de {totalEpisodes} episódios assistidos
      </p>
    </div>
  );
}
