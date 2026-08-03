"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { X, Trophy, Share2, TrendingUp, Calendar, Moon, Sunrise, Sun, Sunset, Play, CheckCircle2 } from "lucide-react";
import { useYearInReview, type YearInReview, type PosterRef } from "@/lib/queries/yearInReview";
import { usePosterColor } from "@/lib/usePosterColor";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const DISMISS_KEY_PREFIX = "seenlist:year-in-review-seen:";
const TOTAL_SLIDES = 12;
const MONTH_NAMES_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * A PEDIDO — segunda reformulação: mudança de FILOSOFIA, não só de
 * conteúdo. Antes ("Redesign completo — 11 telas"): números com
 * ícone genérico. Agora: pôster é protagonista em toda tela onde faz
 * sentido — fundo de colagem MUDA por tela (gênero usa pôster
 * daquele gênero, mês usa pôster daquele mês, etc.), cor de destaque
 * extraída do pôster relevante de cada tela (não é sempre âmbar fixo
 * — cada tela "veste" a cor do que está mostrando), e toda
 * curiosidade que puder apontar pra uma série específica, aponta
 * (maior maratona → de qual série; horário favorito → qual série
 * dominou aquele horário).
 *
 * `usePosterColor` só é chamado UMA vez (regra dos hooks — não pode
 * ser condicional), com o "pôster-chave" do slide ATUAL decidido por
 * `getSlideHeroPoster`. Cai pro âmbar padrão (`null`) quando o slide
 * não tem pôster específico (heatmap, badges) ou a extração falha.
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

function getSlideHeroPoster(index: number, data: YearInReview): PosterRef | null {
  switch (index) {
    case 2: // horas
      return data.topSeries ? { ...data.topSeries, mediaType: "series" } : null;
    case 3: // mês
      return data.mostActiveMonth?.posters[0] ?? null;
    case 5: // gêneros
      return data.topGenre?.posters[0] ?? null;
    case 6: // série do ano
      return data.topSeries ? { ...data.topSeries, mediaType: "series" } : null;
    case 8: // curiosidades
      return data.biggestBingeDay?.series ?? data.favoriteTimeOfDay?.series ?? null;
    default:
      return null;
  }
}

function ProgressBars({ total, current }: { total: number; current: number }) {
  return (
    <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
          <div className={`h-full rounded-full bg-primary transition-all ${i <= current ? "w-full" : "w-0"}`} />
        </div>
      ))}
    </div>
  );
}

/**
 * A PEDIDO — inverter a hierarquia: antes, o fundo desfocado ERA a
 * "aparição" do pôster (borrado demais, escurecido demais — virava
 * decoração). Agora, `intensity="light"` (abertura, compartilhamento)
 * deixa os pôsteres claramente reconhecíveis, com só o escurecimento
 * mínimo pra legibilidade do texto — o pôster nítido de verdade fica
 * pro `PosterMosaic` (conteúdo, não fundo).
 */
function CollageBackground({
  posters,
  accentColor,
  intensity = "medium",
}: {
  posters: PosterRef[];
  accentColor: string | null;
  intensity?: "light" | "medium";
}) {
  const filled = posters.filter((p) => p.posterPath).slice(0, 6);
  const rgb = accentColor ?? "232 163 61";
  const blurClass = intensity === "light" ? "" : "blur-md";
  const collageOpacity = intensity === "light" ? "opacity-90" : "opacity-40";
  const overlayClass = intensity === "light" ? "bg-background/25" : "bg-background/80";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {filled.length > 0 ? (
        <div className={`absolute inset-0 grid grid-cols-3 gap-0.5 ${collageOpacity} ${blurClass}`}>
          {Array.from({ length: 6 }).map((_, i) => {
            const poster = filled[i % filled.length];
            return poster?.posterPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- fundo decorativo, capturado por html-to-image
              <img key={i} src={tmdbImage(poster.posterPath, "w300") ?? ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <div key={i} />
            );
          })}
        </div>
      ) : null}
      <div className={`absolute inset-0 ${overlayClass}`} />
      <div
        className="absolute inset-x-0 top-0 h-2/3"
        style={{ background: `radial-gradient(120% 90% at 50% 0%, rgb(${rgb} / 0.35) 0%, rgb(${rgb} / 0.08) 45%, transparent 75%)` }}
      />
    </div>
  );
}

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string | null }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted" style={color ? { color: `rgb(${color})` } : undefined}>
      ✦ {children}
    </p>
  );
}

function StatChip({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-xl font-extrabold text-primary">{value}</p>
      <p className="text-[10px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function PosterThumb({ poster, size = "sm" }: { poster: PosterRef; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-44 w-32" : size === "md" ? "h-24 w-16" : "h-14 w-10";
  if (!poster.posterPath) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
    <img
      src={tmdbImage(poster.posterPath, size === "lg" ? "w342" : "w185") ?? ""}
      alt={poster.title}
      className={`${dims} shrink-0 rounded-lg object-cover shadow-lg ring-1 ring-white/10`}
    />
  );
}

/**
 * A PEDIDO — "os pôsteres estão sendo usados só como decoração,
 * quero inverter a hierarquia". Diferente de `PosterThumb` (miniatura
 * pequena, ao lado de texto) e de `CollageBackground` (fundo
 * desfocado) — este é CONTEÚDO de verdade: nítido, grande, ocupa
 * espaço real na tela. Usado nas telas de horas/mês/gêneros —
 * lugares que antes só tinham 3-4 miniaturas pequenas competindo com
 * o texto, agora têm uma faixa de pôsteres que É a resposta visual
 * ("é POR ISSO que você tem esse número").
 */
function PosterMosaic({ posters, count = 5 }: { posters: PosterRef[]; count?: number }) {
  const filled = posters.filter((p) => p.posterPath).slice(0, count);
  if (filled.length === 0) return null;
  return (
    <div className="flex w-full justify-center gap-1.5 overflow-hidden">
      {filled.map((poster) => (
        // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
        <img
          key={`${poster.mediaType}-${poster.id}`}
          src={tmdbImage(poster.posterPath!, "w300") ?? ""}
          alt={poster.title}
          className="h-28 flex-1 rounded-lg object-cover shadow-xl ring-1 ring-white/10"
          style={{ maxWidth: `${100 / filled.length}%` }}
        />
      ))}
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

function YearHeatmap({ dailyActivity, year }: { dailyActivity: YearInReview["dailyActivity"]; year: number }) {
  const countByDate = new Map(dailyActivity.map((d) => [d.date, d.count]));
  const maxCount = Math.max(1, ...dailyActivity.map((d) => d.count));
  const start = new Date(`${year}-01-01T00:00:00`);
  const startWeekday = start.getDay();
  const days: { date: string; count: number; month: number }[] = [];
  for (let i = 0; i < startWeekday; i++) days.push({ date: "", count: -1, month: -1 });
  for (let d = new Date(start); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ date: key, count: countByDate.get(key) ?? 0, month: d.getMonth() });
  }
  const weeks: { date: string; count: number; month: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // Rótulo de mês só na semana onde aquele mês COMEÇA — evita repetir o nome em toda coluna.
  const monthLabelByWeek = weeks.map((week, wi) => {
    const firstDayOfMonthInWeek = week.find((d) => d.date && Number(d.date.slice(8, 10)) <= 7);
    if (!firstDayOfMonthInWeek) return null;
    const isFirstOccurrence = wi === 0 || weeks[wi - 1]?.every((d) => d.month !== firstDayOfMonthInWeek.month);
    return isFirstOccurrence ? MONTH_NAMES_SHORT[firstDayOfMonthInWeek.month] : null;
  });

  function opacityFor(count: number) {
    if (count < 0) return 0;
    if (count === 0) return 0.08;
    return Math.min(0.25 + (count / maxCount) * 0.75, 1);
  }
  return (
    <div className="flex gap-[3px] overflow-hidden">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col items-center gap-[3px]">
          <p className="h-3 text-[8px] leading-3 text-muted">{monthLabelByWeek[wi] ?? ""}</p>
          {week.map((day, di) => (
            <div key={di} className="h-[7px] w-[7px] rounded-[2px] bg-primary" style={{ opacity: opacityFor(day.count) }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MonthlyBarChart({ monthlyActivity }: { monthlyActivity: YearInReview["monthlyActivity"] }) {
  const max = Math.max(1, ...monthlyActivity.map((m) => m.count));
  return (
    <div className="flex h-24 w-full items-end gap-1.5">
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

  const { index, next, prev } = useSlideNavigation(TOTAL_SLIDES, handleClose);

  const heroPoster = useMemo(() => (data ? getSlideHeroPoster(index, data) : null), [index, data]);
  const extractedColor = usePosterColor(heroPoster?.posterPath ? (tmdbImage(heroPoster.posterPath, "w185") ?? null) : null);

  if (!open || reviewYear == null) return null;

  const hours = data ? Math.round(data.totalMinutesWatched / 60) : 0;
  const percentileLabel =
    data?.activityPercentile != null && data.activityPercentile > 0 ? t("yearInReview.topPercent", { percent: data.activityPercentile }) : null;
  const TimeIcon = data?.favoriteTimeOfDay ? TIME_OF_DAY_ICON[data.favoriteTimeOfDay.period] : null;

  // Conjunto de pôsteres pro fundo de CADA tela — muda conforme o que a tela está mostrando.
  const collageForSlide: PosterRef[] = data
    ? {
        0: data.allPosters.slice(0, 6),
        1: data.allPosters.slice(0, 9),
        2: data.topSeriesRanking.map((s) => ({ ...s, mediaType: "series" as const })),
        3: data.mostActiveMonth?.posters ?? [],
        4: [],
        5: data.topGenre?.posters ?? [],
        6: data.topSeries ? [{ ...data.topSeries, mediaType: "series" as const }] : [],
        7: data.topSeriesRanking.map((s) => ({ ...s, mediaType: "series" as const })),
        8: [data.biggestBingeDay?.series, data.favoriteTimeOfDay?.series].filter((p): p is PosterRef => !!p),
        9: data.startedSeriesPosters,
        10: [],
        11: data.allPosters.slice(0, 9),
      }[index] ?? []
    : [];

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      role="dialog"
      aria-modal="true"
    >
      <ProgressBars total={TOTAL_SLIDES} current={index} />
      <button type="button" onClick={handleClose} aria-label={t("social.close")} className="absolute right-3 top-8 z-20 text-white/80">
        <X className="h-5 w-5" strokeWidth={2} />
      </button>
      <button type="button" onClick={prev} aria-label={t("common.back")} className="absolute inset-y-0 left-0 z-20 w-1/3" />
      <button type="button" onClick={next} aria-label={t("yearInReview.next")} className="absolute inset-y-0 right-0 z-20 w-1/3" />

      {isLoading || !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/70">{t("common.loading")}</div>
      ) : (
        <>
          <div ref={slideRef} className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background px-6 text-center">
            <CollageBackground posters={collageForSlide} accentColor={extractedColor} intensity={index === 0 || index === 11 ? "light" : "medium"} />

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

            {/* 2 — Seu ano em pôsteres (mural, sem estatística) */}
            {index === 1 && (
              <div className="relative flex w-full flex-col items-center">
                <Eyebrow>{t("yearInReview.posterWallTitle")}</Eyebrow>
                <p className="mt-2 max-w-[260px] text-xl font-extrabold leading-tight text-text">{t("yearInReview.posterWallSubtitle")}</p>
                <div className="mt-6 grid w-full max-w-[300px] grid-cols-3 gap-2">
                  {data.allPosters.slice(0, 9).map((poster) => (
                    <div key={`${poster.mediaType}-${poster.id}`} className="aspect-[2/3] overflow-hidden rounded-lg shadow-lg">
                      {poster.posterPath && (
                        // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
                        <img src={tmdbImage(poster.posterPath, "w300") ?? ""} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3 — Horas assistidas */}
            {index === 2 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow color={extractedColor}>{t("yearInReview.youWatched")}</Eyebrow>
                <p className="mt-2 text-7xl font-extrabold leading-none" style={{ color: extractedColor ? `rgb(${extractedColor})` : undefined }}>
                  {hours}
                </p>
                <p className="mt-3 text-lg font-bold text-text">{t("yearInReview.hoursIn", { year: reviewYear })}</p>
                {hours > 0 && (
                  <p className="mt-3 max-w-[240px] text-sm text-muted">{t("yearInReview.hoursComparison", { days: Math.round(hours / 24) })}</p>
                )}
                {data.topSeriesRanking.length > 0 && (
                  <>
                    <p className="mt-6 text-xs text-muted">{t("yearInReview.hoursGeneratedBy")}</p>
                    <div className="mt-3 w-full max-w-[280px]">
                      <PosterMosaic posters={data.topSeriesRanking.map((s) => ({ ...s, mediaType: "series" }))} count={5} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 4 — Atividade mensal */}
            {index === 3 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow color={extractedColor}>{t("yearInReview.monthlyActivityTitle")}</Eyebrow>
                {data.mostActiveMonth && (
                  <p className="mt-2 text-2xl font-extrabold text-text">
                    {t("yearInReview.mostActiveMonthWasLabel", { month: data.mostActiveMonth.name })}
                  </p>
                )}
                <div className="mt-6 w-full">
                  <MonthlyBarChart monthlyActivity={data.monthlyActivity} />
                </div>
                {data.mostActiveMonth && data.mostActiveMonth.posters.length > 0 && (
                  <div className="mt-5 w-full max-w-[280px]">
                    <PosterMosaic posters={data.mostActiveMonth.posters} count={4} />
                  </div>
                )}
              </div>
            )}

            {/* 5 — Heatmap + primeiro/último episódio */}
            {index === 4 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.heatmapTitle")}</Eyebrow>
                <p className="mt-2 text-xl font-extrabold text-text">{t("yearInReview.heatmapSubtitle", { count: data.dailyActivity.length })}</p>
                <div className="mt-5 flex justify-center overflow-x-auto">
                  <YearHeatmap dailyActivity={data.dailyActivity} year={reviewYear} />
                </div>
                {(data.longestStreakDays > 1 || data.biggestBingeDay) && (
                  <div className="mt-6 flex w-full gap-3">
                    {data.longestStreakDays > 1 && (
                      <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                        <p className="text-[11px] text-muted">{t("yearInReview.longestStreakLabel")}</p>
                        <p className="mt-1 text-lg font-extrabold text-text">{t("yearInReview.longestStreak", { days: data.longestStreakDays })}</p>
                      </div>
                    )}
                    {data.biggestBingeDay && data.biggestBingeDay.count > 1 && (
                      <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                        {data.biggestBingeDay.series && <PosterThumb poster={data.biggestBingeDay.series} size="sm" />}
                        <div className="min-w-0">
                          <p className="text-[11px] text-muted">{t("yearInReview.biggestDayLabel")}</p>
                          <p className="text-sm font-extrabold text-text">{t("yearInReview.biggestBinge", { count: data.biggestBingeDay.count })}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 6 — Gêneros favoritos, com pôsteres como prova */}
            {index === 5 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow color={extractedColor}>{t("yearInReview.topGenresTitle")}</Eyebrow>
                {data.topGenres[0] && (
                  <div className="mt-4 w-full">
                    <p className="text-2xl font-extrabold text-text">{data.topGenres[0].name}</p>
                    <div className="mt-3 w-full max-w-[280px]">
                      <PosterMosaic posters={data.topGenres[0].posters} count={4} />
                    </div>
                  </div>
                )}
                {data.topGenres.length > 1 && (
                  <div className="mt-6 flex w-full flex-col gap-3">
                    {data.topGenres.slice(1).map((genre, i) => {
                      const max = data.topGenres[0]?.count ?? 1;
                      return (
                        <div key={genre.name} className="text-left">
                          <p className="text-sm font-extrabold text-text">
                            {i + 2}. {genre.name}
                          </p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(genre.count / max) * 100}%` }} />
                          </div>
                          {genre.posters.length > 0 && (
                            <div className="mt-1.5 flex gap-1.5">
                              {genre.posters.slice(0, 4).map((p) => (
                                <PosterThumb key={`${p.mediaType}-${p.id}`} poster={p} size="sm" />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 7 — Série do ano (tratamento cinematográfico) */}
            {index === 6 && data.topSeries && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                {data.topSeries.posterPath && (
                  // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
                  <img
                    src={tmdbImage(data.topSeries.posterPath, "w500") ?? ""}
                    alt=""
                    className="mb-6 h-64 w-44 rounded-xl object-cover shadow-2xl ring-1 ring-white/20"
                  />
                )}
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: extractedColor ? `rgb(${extractedColor})` : undefined }}>
                  🏆 {t("yearInReview.topSeries")}
                </p>
                <p className="mt-2 text-3xl font-extrabold leading-tight text-text">{data.topSeries.title}</p>
                <p className="mt-3 text-sm text-muted">{t("yearInReview.livedIn", { count: data.topSeries.episodeCount })}</p>
              </div>
            )}

            {/* 8 — Top 5 séries */}
            {index === 7 && data.topSeriesRanking.length > 0 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.top5Title")}</Eyebrow>
                <div className="mt-5 flex w-full flex-col gap-2">
                  {[...data.topSeriesRanking].reverse().map((series, i) => {
                    const rank = data.topSeriesRanking.length - i;
                    return (
                      <div
                        key={series.id}
                        className={`flex items-center gap-3 rounded-xl border p-2 text-left ${rank === 1 ? "border-primary bg-primary/10" : "border-white/10 bg-white/5"}`}
                      >
                        <p className={`w-5 text-sm font-extrabold ${rank === 1 ? "text-primary" : "text-muted"}`}>{rank === 1 ? "🏆" : rank}</p>
                        {series.posterPath && (
                          // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
                          <img src={tmdbImage(series.posterPath, "w185") ?? ""} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-text">{series.title}</p>
                          <p className="text-[10px] text-muted">{t("yearInReview.episodeCount", { count: series.episodeCount })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 9 — Curiosidades, cada uma com a série responsável */}
            {index === 8 && (
              <div className="relative flex w-full max-w-[300px] flex-col items-center">
                <Eyebrow>{t("yearInReview.funFactsTitle")}</Eyebrow>
                <div className="mt-5 flex w-full flex-col gap-2.5">
                  {data.favoriteTimeOfDay && TimeIcon && (
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                      {data.favoriteTimeOfDay.series && <PosterThumb poster={data.favoriteTimeOfDay.series} size="md" />}
                      <div className="min-w-0 flex-1">
                        <TimeIcon className="h-4 w-4 text-primary" strokeWidth={2} />
                        <p className="mt-1 text-sm font-extrabold text-text">{t(`yearInReview.timeOfDay.${data.favoriteTimeOfDay.period}`)}</p>
                        <p className="truncate text-[11px] text-muted">{data.favoriteTimeOfDay.series?.title ?? t("yearInReview.favoriteTimeOfDayLabel")}</p>
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

            {/* 10 — Iniciadas vs concluídas (mural das iniciadas) */}
            {index === 9 && (
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
                {data.startedSeriesPosters.length > 0 && (
                  <div className="mt-4 grid grid-cols-6 gap-1.5">
                    {data.startedSeriesPosters.slice(0, 12).map((p) => (
                      <div key={`${p.mediaType}-${p.id}`} className="aspect-[2/3] overflow-hidden rounded-md">
                        {p.posterPath && (
                          // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image
                          <img src={tmdbImage(p.posterPath, "w185") ?? ""} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 11 — Badges/conquistas + percentual */}
            {index === 10 && (
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

            {/* 12 — Compartilhamento (wallpaper: colagem domina, resumo ancorado embaixo) */}
            {index === 11 && (
              <div className="relative flex h-full w-full flex-col justify-end px-2 pb-8">
                <div className="flex flex-col items-center rounded-2xl bg-background/70 p-5 backdrop-blur-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold text-background shadow-lg">
                    S
                  </div>
                  <p className="mt-2 text-lg font-extrabold text-text">{t("yearInReview.myYear", { year: reviewYear })}</p>
                  <div className="mt-4 flex gap-6">
                    <div>
                      <p className="text-xl font-extrabold text-primary">{hours}h</p>
                      <p className="text-[11px] text-muted">{t("yearInReview.hoursWatched")}</p>
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-primary">{data.totalEpisodesWatched}</p>
                      <p className="text-[11px] text-muted">{t("yearInReview.episodesWatched")}</p>
                    </div>
                  </div>
                  {data.topSeries && (
                    <div className="mt-4 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted">{t("yearInReview.topSeries")}</p>
                      <p className="text-sm font-extrabold text-text">{data.topSeries.title}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {index === TOTAL_SLIDES - 1 && (
            <div className="z-10 flex flex-col items-center gap-3 pb-8 pt-4">
              <p className="text-xs text-muted">{t("yearInReview.shareCta")}</p>
              <ShareButton slideRef={slideRef} year={reviewYear} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
