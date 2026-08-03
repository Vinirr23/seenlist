"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { X, Clock, Tv, Trophy, Share2 } from "lucide-react";
import { useYearInReview } from "@/lib/queries/yearInReview";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const DISMISS_KEY_PREFIX = "seenlist:year-in-review-seen:";

/**
 * A PEDIDO — "Seu ano" virou formato de slides (estilo Stories do
 * Instagram) porque o objetivo real não é só mostrar dentro do app —
 * é a pessoa BAIXAR e postar no Stories/WhatsApp/Threads. Cada slide
 * é pensado pra fazer sentido sozinho, fora de contexto, como uma
 * imagem que alguém vê sem ter aberto o SeenList.
 *
 * `slideRef` aponta pro slide ATUAL — é o que vira PNG quando a
 * pessoa aperta "compartilhar" (html-to-image captura só o que está
 * dentro da ref, não a tela inteira com barra de progresso/botão X).
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
    <div className="absolute inset-x-3 top-3 z-10 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
          <div className={`h-full rounded-full bg-primary transition-all ${i < current ? "w-full" : i === current ? "w-full" : "w-0"}`} />
        </div>
      ))}
    </div>
  );
}

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
        // Sem suporte a compartilhamento nativo (a maioria dos navegadores
        // desktop) — baixa a imagem direto, a pessoa compartilha na mão.
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

export function YearInReviewModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reviewYear, setReviewYear] = useState<number | null>(null);
  const { data, isLoading } = useYearInReview(reviewYear ?? new Date().getFullYear());
  const { t } = useTranslation();
  const slideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Só pra teste — ?preview-year-in-review=2025 força a abertura
    // mostrando o resumo daquele ano, mesmo fora de dezembro/janeiro
    // e mesmo já tendo sido dispensado antes.
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

  const totalSlides = 4;
  const { index, next, prev } = useSlideNavigation(totalSlides, handleClose);

  if (!open || reviewYear == null) return null;

  const hours = data ? Math.round(data.totalMinutesWatched / 60) : 0;
  const percentileLabel =
    data?.activityPercentile != null && data.activityPercentile > 0 ? t("yearInReview.topPercent", { percent: data.activityPercentile }) : null;

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

      {/* Áreas de toque — esquerda volta, direita avança, mesma convenção do Instagram Stories. */}
      <button type="button" onClick={prev} aria-label={t("common.back")} className="absolute inset-y-0 left-0 z-10 w-1/3" />
      <button type="button" onClick={next} aria-label={t("yearInReview.next")} className="absolute inset-y-0 right-0 z-10 w-1/3" />

      {isLoading || !data ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white/70">{t("common.loading")}</div>
      ) : (
        <>
          <div
            ref={slideRef}
            className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-background px-8 text-center"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(120%_90%_at_50%_0%,rgb(var(--color-primary)/0.28)_0%,rgb(var(--color-primary)/0.06)_45%,transparent_75%)]"
              aria-hidden="true"
            />
            {index === 0 && (
              <>
                <p className="relative text-xs font-semibold uppercase tracking-wide text-muted">✦ {t("yearInReview.youWatched")}</p>
                <p className="relative mt-2 text-8xl font-extrabold leading-none text-primary">{hours}</p>
                <p className="relative mt-3 text-lg font-bold text-text">{t("yearInReview.hoursIn", { year: reviewYear })}</p>
                {hours > 0 && (
                  <p className="relative mt-4 max-w-[240px] text-sm text-muted">
                    {t("yearInReview.hoursComparison", { days: Math.round(hours / 24) })}
                  </p>
                )}
              </>
            )}
            {index === 1 && data.topSeries && (
              <>
                {data.topSeries.posterPath && (
                  // eslint-disable-next-line @next/next/no-img-element -- capturado por html-to-image, next/image não funciona bem com essa lib
                  <img
                    src={tmdbImage(data.topSeries.posterPath, "w342") ?? ""}
                    alt=""
                    className="relative mb-5 h-44 w-32 rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
                  />
                )}
                <p className="relative text-xs font-semibold uppercase tracking-wide text-primary">🏆 {t("yearInReview.topSeries")}</p>
                <p className="relative mt-2 text-2xl font-extrabold leading-tight text-text">{data.topSeries.title}</p>
                <p className="relative mt-2 text-sm text-muted">{t("yearInReview.episodeCount", { count: data.topSeries.episodeCount })}</p>
              </>
            )}
            {index === 1 && !data.topSeries && (
              <>
                <Tv className="relative h-10 w-10 text-primary" strokeWidth={1.75} />
                <p className="relative mt-4 text-lg font-bold text-text">{t("yearInReview.episodesWatched")}</p>
                <p className="relative mt-1 text-4xl font-extrabold text-primary">{data.totalEpisodesWatched}</p>
              </>
            )}
            {index === 2 && (
              <>
                <p className="relative text-xs font-semibold uppercase tracking-wide text-muted">✦ {t("yearInReview.yourPerformance")}</p>
                <div
                  className="relative mt-4 flex h-36 w-36 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(rgb(var(--color-primary)) ${Math.min(data.activityPercentile ? 100 - data.activityPercentile : 0, 100)}%, rgb(var(--color-surface)) 0)`,
                  }}
                >
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-background">
                    <div>
                      <p className="text-2xl font-extrabold text-text">{hours}h</p>
                    </div>
                  </div>
                </div>
                {percentileLabel ? (
                  <div className="relative mt-5 flex items-center gap-1.5 rounded-full border border-primary bg-primary/15 px-4 py-1.5">
                    <Trophy className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                    <p className="text-xs font-bold text-primary">{percentileLabel}</p>
                  </div>
                ) : (
                  <p className="relative mt-5 text-sm text-muted">{t("yearInReview.hoursWatched")}</p>
                )}
              </>
            )}
            {index === 3 && (
              <>
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-background shadow-lg">
                  S
                </div>
                <p className="relative mt-3 text-base font-bold text-text">seenlist</p>
                <div className="relative mt-6 flex gap-6">
                  <div>
                    <p className="text-xl font-extrabold text-primary">{hours}h</p>
                    <p className="text-[11px] text-muted">{t("yearInReview.hoursWatched")}</p>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-primary">{data.totalEpisodesWatched}</p>
                    <p className="text-[11px] text-muted">{t("yearInReview.episodesWatched")}</p>
                  </div>
                </div>
                <p className="relative mt-8 max-w-[220px] text-sm text-muted">{t("yearInReview.shareCta")}</p>
              </>
            )}
          </div>

          {index === 3 && (
            <div className="z-10 flex justify-center pb-8 pt-4">
              <ShareButton slideRef={slideRef} year={reviewYear} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
