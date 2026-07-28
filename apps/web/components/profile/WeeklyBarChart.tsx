"use client";

import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

export interface WeeklyBarChartProps {
  weeks: { weekStart: string; count: number }[];
  colorClass?: string;
}

/**
 * TASK-054 — gráfico simples em CSS (barras com altura proporcional),
 * sem adicionar biblioteca de gráficos nova ao projeto. Dado real
 * (useEpisodesTimeline), sem valor inventado — semanas sem episódio
 * aparecem como barra de altura zero, não são omitidas.
 */
export function WeeklyBarChart({ weeks, colorClass = "bg-primary" }: WeeklyBarChartProps) {
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const { t, locale } = useTranslation();
  const weekdayFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "2-digit" });

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
                title={t("profile.weeklyChartTooltip", {
                  count: week.count,
                  episodeWord: week.count === 1 ? t("profile.episodeSingular") : t("profile.episodePlural"),
                  date: weekdayFormatter.format(new Date(`${week.weekStart}T00:00:00`)),
                })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
