"use client";

export interface WeeklyBarChartProps {
  weeks: { weekStart: string; count: number }[];
  colorClass?: string;
}

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * TASK-054 — gráfico simples em CSS (barras com altura proporcional),
 * sem adicionar biblioteca de gráficos nova ao projeto. Dado real
 * (useEpisodesTimeline), sem valor inventado — semanas sem episódio
 * aparecem como barra de altura zero, não são omitidas.
 */
export function WeeklyBarChart({ weeks, colorClass = "bg-primary" }: WeeklyBarChartProps) {
  const max = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <div className="flex h-24 items-end gap-1.5">
      {weeks.map((week) => {
        const heightPercent = Math.max(4, (week.count / max) * 100);
        return (
          <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end">
              <div
                className={`w-full rounded-t ${week.count > 0 ? colorClass : "bg-border"}`}
                style={{ height: `${heightPercent}%` }}
                title={`${week.count} episódio${week.count === 1 ? "" : "s"} na semana de ${weekdayFormatter.format(new Date(`${week.weekStart}T00:00:00`))}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
