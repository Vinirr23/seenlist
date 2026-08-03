"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { X, Trophy, Share2, TrendingUp, Calendar, Flame, Moon, Sunrise, Sun, Sunset, Sparkles, Play, CheckCircle2 } from "lucide-react";
import { useYearInReview, type YearInReview } from "@/lib/queries/yearInReview";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const DISMISS_KEY_PREFIX = "seenlist:year-in-review-seen:";

/**
 * A PEDIDO — redesenho completo, inspirado em Spotify Wrapped/Steam
 * Replay/Letterboxd Year in Review: de 2 telas de estatística pra 11
 * telas contando uma história do ano, cada uma pensada pra fazer
 * sentido sozinha como imagem (é pra isso que existe — compartilhar
 * no Stories/WhatsApp/Threads). Identidade do SeenList mantida em
 * tudo (preto, âmbar, branco) — nenhuma cor nova.
 *
 * `slideRef` aponta pro slide ATUAL — é o que vira PNG quando a
 * pessoa aperta "compartilhar".
 */
function useSlideNavigation(totalSlides: number, onFinish: () => void) {
  const [index, setIndex] = useState(0);
  function next() {
    if (index < totalSlides - 1) setIndex((i) => i + 1);
    else onFinish();
  }
  function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }
  return { index, next, prev };
}

function ProgressBars({ total, current }: { total: number; current: number }) {
  return (
    <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
          <div className={`h-full rounded-full bg-primary transition-all ${i <= current ? "w-full" : "w-0"}`} />
        </div>
      ))}
    </div>
  );
}

function Glow() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(120%_90%_at_50%_0%,rgb(var(--color-primary)/0.28)_0%,rgb(var(--color-primary)/0.06)_45%,transparent_75%)]"
      aria-hidden="true"
    />
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted">✦ {children}</p>;
}

function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-xl font-extrabold text-primary">{value}</p>
      <p className="text-[10px] leading-tight text-muted">{label}</p>
    </div>
  );
}

const TIME_OF_DAY_ICON = { dawn: Moon, morning: Sunrise, afternoon: Sun, night: Sunset };

function ShareButton({ slideRef, year }: { slideRef: React.RefObject<HTMLDivElement | null>; year: number }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    if (!slideRef.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(slideRef.current, { pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `seenlist-${year}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `SeenList ${year}` });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `seenlist-${year}.png`;
        link.click();
      }
    } catch (error) {
      console.error("[YearInReview] Falha ao gerar/compartilhar imagem", error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={busy}
      className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
    >
      <Share2 className="h-4 w-4" strokeWidth={2.5} />
      {busy ? t("yearInReview.preparing") : t("yearInReview.share")}
    </button>
  );
}

/** Grade estilo "contribuições do GitHub" — cada quadrado é um dia, cor mais forte = mais atividade naquele dia. */
function YearHeatmap({ dailyActivity, year }: { dailyActivity: YearInReview["dailyActivity"]; year: number }) {
  const countByDate = new Map(dailyActivity.map((d) => [d.date, d.count]));
  const maxCount = Math.max(1, ...dailyActivity.map((d) => d.count));
  const start = new Date(`${year}-01-01T00:00:00`);
  const startWeekday = start.getDay();
  const days: { date: string; count: number }[] = [];
  for (let i = 0; i < startWeekday; i++) days.push({ date: "", count: -1 });
  for (let d = new Date(start); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ date: key, count: countByDate.get(key) ?? 0 });
  }
  const weeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  function opacityFor(count: number) {
    if (count < 0) return 0;
    if (count === 0) return 0.08;
    return Math.min(0.25 + (count / maxCount) * 0.75, 1);
  }

  return (
    <div className="flex gap-[3px] overflow-hidden">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((day, di) => (
            <div
              key={di}
              className="h-[7px] w-[7px] rounded-[2px] bg-primary"
              style={{ opacity: opacityFor(day.count) }}
              title={day.date || undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Gráfico de barras simples, 12 colunas, altura proporcional ao mês mais ativo. */
function MonthlyBarChart({ monthlyActivity }: { monthlyActivity: YearInReview["monthlyActivity"] }) {
  const max = Math.max(1, ...monthlyActivity.map((m) => m.count));
  return (
    <div className="flex h-32 w-full items-end gap-1.5">
      {monthlyActivity.map((month) => (
        <div key={month.name} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className="w-full rounded-t-sm bg-primary transition-all"
            style={{ height: `${Math.max((month.count / max) * 100, 3)}%`, opacity: month.count === max ? 1 : 0.45 }}
          />
          <p className="text-[9px] text-muted">{month.name}</p>
        </div>
      ))}
    </div>
  );
}

export function YearInReviewModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reviewYear, setReviewYear] = useState<number | null>(null);
  const { data, isLoading } = useYearInReview(reviewYear ?? new Date().getFullYear());
  const { t } = useTranslation();
  const slideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previewYear = new URLSearchParams(window.location.search).get("preview-year-in-review");
    if (previewYear) {
      setReviewYear(Number(previewYear));
      setOpen(true);
      return;
    }
    const now = new Date();
    const month = now.getMonth();
    if (month !== 11 && month !== 0) return;
    const year = month === 11 ? now.getFullYear() : now.getFullYear() - 1;
    if (localStorage.getItem(`${DISMISS_KEY_PREFIX}${year}`) === "1") return;
    setReviewYear(year);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleClose() {
    if (reviewYear != null) localStorage.setItem(`${DISMISS_KEY_PREFIX}${reviewYear}`, "1");
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  const totalSlides = 11;
  const { index, next, prev } = useSlideNavigation(totalSlides, handleClose);

  if (!open || reviewYear == null) return null;

  const hours = data ? Math.round(data.totalMinutesWatched / 60) : 0;
  const percentileLabel =
    data?.activityPercentile != null && data.activityPercentile > 0 ? t("yearInReview.topPercent", { percent: data.activityPercentile }) : null;
  const TimeIcon = data?.favoriteTimeOfDay ? TIME_OF_DAY_ICON[data.favoriteTimeOfDay.period] : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      role="dialog"
      aria-modal="true"
    >
      <ProgressBars total={totalSlides} current={index} />
      <button type="button" onClick={handleClose} aria-label={t("social.close")} className="absolute right-3 top-8 z-10 text-white/80">
        <X className="h-5 w-5" strokeWidth={2} />
      </button>
      <button type="button" onClick={prev} aria-label={t("common.back")} className="absolute inset-y-0 left-0 z-10 w-1/3" />
      <button type="button" onClick={next} aria-label={t("yearInReview.next")} className="absolute inset-y-0 right-0 z-10 w-1/3" />

      {isLoading || !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/70">{t("common.loading")}</div>
      ) : (
        <>
          <div
            ref={slideRef}
            className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background px-6 text-center transition-opacity duration-300"
            key={index}
          >
            <Glow />

            {/* 1 — Abertura */}
            {index === 0 && (
              <div className="relative flex flex-col items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-extrabold text-background shadow-2xl">
                  S
                </div>
                <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-primary">seenlist</p>
                <p className="mt-3 text-3xl font-extrabold text-text">{t("yearInReview.openingTitle", { year: reviewYear })}</p>
                <p className="mt-3 max-w-[260px] text-sm text-muted">{t("yearInReview.openingSubtitle")}</p>
              </div>
            )}

            {/* 2 — Horas assistidas */}
            {index === 1 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.youWatched")}</Eyebrow>
                <p className="mt-2 text-7xl font-extrabold leading-none text-primary">{hours}</p>
                <p className="mt-3 text-lg font-bold text-text">{t("yearInReview.hoursIn", { year: reviewYear })}</p>
                {hours > 0 && (
                  <p className="mt-3 max-w-[240px] text-sm text-muted">{t("yearInReview.hoursComparison", { days: Math.round(hours / 24) })}</p>
                )}
                <div className="mt-6 flex w-full gap-2">
                  <StatChip value={data.totalEpisodesWatched} label={t("yearInReview.episodesWatched")} />
                  <StatChip value={data.totalMoviesWatched} label={t("yearInReview.moviesWatched")} />
                </div>
              </div>
            )}

            {/* 3 — Atividade mensal */}
            {index === 2 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.monthlyActivityTitle")}</Eyebrow>
                {data.mostActiveMonth && (
                  <p className="mt-2 text-2xl font-extrabold text-text">
                    {t("yearInReview.mostActiveMonthWasLabel", { month: data.mostActiveMonth.name })}
                  </p>
                )}
                <div className="mt-8 w-full">
                  <MonthlyBarChart monthlyActivity={data.monthlyActivity} />
                </div>
              </div>
            )}

            {/* 4 — Heatmap do ano */}
            {index === 3 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.heatmapTitle")}</Eyebrow>
                <p className="mt-2 text-2xl font-extrabold text-text">{t("yearInReview.heatmapSubtitle", { count: data.dailyActivity.length })}</p>
                <div className="mt-6 flex justify-center overflow-x-auto">
                  <YearHeatmap dailyActivity={data.dailyActivity} year={reviewYear} />
                </div>
              </div>
            )}

            {/* 5 — Gêneros favoritos */}
            {index === 4 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.topGenresTitle")}</Eyebrow>
                <div className="mt-6 flex w-full flex-col gap-3">
                  {data.topGenres.map((genre, i) => {
                    const max = data.topGenres[0]?.count ?? 1;
                    return (
                      <div key={genre.name} className="text-left">
                        <div className="flex items-baseline justify-between">
                          <p className="text-sm font-extrabold text-text">
                            {i + 1}. {genre.name}
                          </p>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(genre.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6 — Série do ano */}
            {index === 5 && data.topSeries && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                {data.topSeries.posterPath && (
                  // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
                  <img
                    src={tmdbImage(data.topSeries.posterPath, "w342") ?? ""}
                    alt=""
                    className="mb-5 h-48 w-32 rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
                  />
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">🏆 {t("yearInReview.topSeries")}</p>
                <p className="mt-2 text-2xl font-extrabold leading-tight text-text">{data.topSeries.title}</p>
                <p className="mt-2 text-sm text-muted">{t("yearInReview.episodeCount", { count: data.topSeries.episodeCount })}</p>
              </div>
            )}

            {/* 7 — Top 5 séries */}
            {index === 6 && data.topSeriesRanking.length > 0 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.top5Title")}</Eyebrow>
                <div className="mt-5 flex w-full flex-col gap-2">
                  {data.topSeriesRanking.map((series, i) => (
                    <div key={series.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 text-left">
                      <p className="w-4 text-sm font-extrabold text-primary">{i + 1}</p>
                      {series.posterPath && (
                        // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
                        <img src={tmdbImage(series.posterPath, "w185") ?? ""} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-text">{series.title}</p>
                        <p className="text-[10px] text-muted">{t("yearInReview.episodeCount", { count: series.episodeCount })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8 — Curiosidades */}
            {index === 7 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.funFactsTitle")}</Eyebrow>
                <div className="mt-5 flex w-full flex-col gap-2.5">
                  {data.biggestBingeDay && data.biggestBingeDay.count > 1 && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                      <Flame className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                      <div>
                        <p className="text-sm font-extrabold text-text">{t("yearInReview.biggestBinge", { count: data.biggestBingeDay.count })}</p>
                        <p className="text-[11px] text-muted">{t("yearInReview.biggestBingeLabel")}</p>
                      </div>
                    </div>
                  )}
                  {data.longestStreakDays > 1 && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                      <Sparkles className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                      <div>
                        <p className="text-sm font-extrabold text-text">{t("yearInReview.longestStreak", { days: data.longestStreakDays })}</p>
                        <p className="text-[11px] text-muted">{t("yearInReview.longestStreakLabel")}</p>
                      </div>
                    </div>
                  )}
                  {data.favoriteTimeOfDay && TimeIcon && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                      <TimeIcon className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                      <div>
                        <p className="text-sm font-extrabold text-text">{t(`yearInReview.timeOfDay.${data.favoriteTimeOfDay.period}`)}</p>
                        <p className="text-[11px] text-muted">{t("yearInReview.favoriteTimeOfDayLabel")}</p>
                      </div>
                    </div>
                  )}
                  {data.favoriteWeekday && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                      <Calendar className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                      <div>
                        <p className="text-sm font-extrabold text-text">{data.favoriteWeekday.name}</p>
                        <p className="text-[11px] text-muted">{t("yearInReview.favoriteWeekday")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 9 — Iniciadas vs concluídas */}
            {index === 8 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.startedVsCompletedTitle")}</Eyebrow>
                <div className="mt-6 flex w-full gap-3">
                  <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-4">
                    <Play className="mx-auto h-5 w-5 text-primary" strokeWidth={2} />
                    <p className="mt-2 text-2xl font-extrabold text-text">{data.seriesStartedCount}</p>
                    <p className="text-[11px] text-muted">{t("yearInReview.seriesStarted")}</p>
                  </div>
                  <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-4">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-primary" strokeWidth={2} />
                    <p className="mt-2 text-2xl font-extrabold text-text">{data.seriesCompletedCount}</p>
                    <p className="text-[11px] text-muted">{t("yearInReview.seriesCompleted")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 10 — Badges/conquistas + percentual */}
            {index === 9 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.yourPerformance")}</Eyebrow>
                <div
                  className="relative mt-4 flex h-32 w-32 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(rgb(var(--color-primary)) ${Math.min(data.activityPercentile ? 100 - data.activityPercentile : 0, 100)}%, rgb(var(--color-surface)) 0)`,
                  }}
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-background">
                    <p className="text-xl font-extrabold text-text">{hours}h</p>
                  </div>
                </div>
                {percentileLabel && (
                  <div className="mt-4 flex items-center gap-1.5 rounded-full border border-primary bg-primary/15 px-4 py-1.5">
                    <Trophy className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                    <p className="text-xs font-bold text-primary">{percentileLabel}</p>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {data.longestStreakDays >= 7 && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-text">
                      🔥 {t("yearInReview.badgeStreak")}
                    </span>
                  )}
                  {data.biggestBingeDay && data.biggestBingeDay.count >= 5 && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-text">
                      🍿 {t("yearInReview.badgeBinger")}
                    </span>
                  )}
                  {data.favoriteTimeOfDay?.period === "dawn" && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-text">
                      🦉 {t("yearInReview.badgeNightOwl")}
                    </span>
                  )}
                  {data.topGenre && data.topGenre.count / Math.max(1, data.totalEpisodesWatched + data.totalMoviesWatched) > 0.4 && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-text">
                      🎯 {t("yearInReview.badgeGenreLoyal")}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 11 — Compartilhamento */}
            {index === 10 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-background shadow-lg">
                  S
                </div>
                <p className="mt-3 text-base font-bold text-text">seenlist</p>
                <div className="mt-6 flex gap-6">
                  <div>
                    <p className="text-xl font-extrabold text-primary">{hours}h</p>
                    <p className="text-[11px] text-muted">{t("yearInReview.hoursWatched")}</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-primary">{data.totalEpisodesWatched}</p>
                    <p className="text-[11px] text-muted">{t("yearInReview.episodesWatched")}</p>
                  </div>
                </div>
                <p className="mt-8 max-w-[220px] text-sm text-muted">{t("yearInReview.shareCta")}</p>
              </div>
            )}
          </div>

          {index === totalSlides - 1 && (
            <div className="z-10 flex flex-col items-center gap-3 pb-8 pt-4">
              <ShareButton slideRef={slideRef} year={reviewYear} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
