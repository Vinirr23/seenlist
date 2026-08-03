"use client";

import { useEffect, useState } from "react";
import { X, Clock, Tv, Film, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { useYearInReview } from "@/lib/queries/yearInReview";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const DISMISS_KEY_PREFIX = "seenlist:year-in-review-seen:";

/**
 * A PEDIDO — "Seu ano" (resumo anual, tipo Spotify Wrapped).
 *
 * DE PROPÓSITO — só usa `bg-primary`/`bg-surface`/`text-text` etc.,
 * os MESMOS tokens que o resto do app já usa, nenhuma cor nova.
 * Depois da última exploração visual não ter dado certo na prática,
 * o caminho mais seguro aqui é usar a identidade que já está
 * aprovada, não inventar uma paleta nova só pra esta tela.
 */
function YearInReviewContent({ year }: { year: number }) {
  const { data, isLoading } = useYearInReview(year);
  const { t } = useTranslation();

  if (isLoading || !data) {
    return <div className="flex flex-1 items-center justify-center text-sm text-muted">{t("common.loading")}</div>;
  }

  const hours = Math.round(data.totalMinutesWatched / 60);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("yearInReview.eyebrow", { year })}</p>
        <h1 className="mt-1 text-2xl font-bold text-text">{t("yearInReview.title")}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface p-4">
          <Clock className="h-5 w-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-2xl font-bold text-text">{hours}</p>
          <p className="text-xs text-muted">{t("yearInReview.hoursWatched")}</p>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <Tv className="h-5 w-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-2xl font-bold text-text">{data.totalEpisodesWatched}</p>
          <p className="text-xs text-muted">{t("yearInReview.episodesWatched")}</p>
        </div>
        <div className="rounded-xl bg-surface p-4">
          <Film className="h-5 w-5 text-primary" strokeWidth={2} />
          <p className="mt-2 text-2xl font-bold text-text">{data.totalMoviesWatched}</p>
          <p className="text-xs text-muted">{t("yearInReview.moviesWatched")}</p>
        </div>
        {data.topGenre && (
          <div className="rounded-xl bg-surface p-4">
            <Sparkles className="h-5 w-5 text-primary" strokeWidth={2} />
            <p className="mt-2 truncate text-lg font-bold text-text">{data.topGenre.name}</p>
            <p className="text-xs text-muted">{t("yearInReview.topGenre")}</p>
          </div>
        )}
      </div>

      {data.topSeries && (
        <div className="flex items-center gap-3 rounded-xl bg-surface p-4">
          {data.topSeries.posterPath && (
            // eslint-disable-next-line @next/next/no-img-element -- pôster pequeno, sem necessidade de otimização do next/image aqui
            <img src={tmdbImage(data.topSeries.posterPath, "w185") ?? ""} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("yearInReview.topSeries")}</p>
            <p className="truncate text-base font-bold text-text">{data.topSeries.title}</p>
            <p className="text-xs text-muted">{t("yearInReview.episodeCount", { count: data.topSeries.episodeCount })}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {data.mostActiveMonth && (
          <div className="rounded-xl bg-surface p-4">
            <TrendingUp className="h-5 w-5 text-secondary" strokeWidth={2} />
            <p className="mt-2 text-lg font-bold text-text">{data.mostActiveMonth.name}</p>
            <p className="text-xs text-muted">{t("yearInReview.mostActiveMonth")}</p>
          </div>
        )}
        {data.favoriteWeekday && (
          <div className="rounded-xl bg-surface p-4">
            <Calendar className="h-5 w-5 text-secondary" strokeWidth={2} />
            <p className="mt-2 text-lg font-bold text-text">{data.favoriteWeekday.name}</p>
            <p className="text-xs text-muted">{t("yearInReview.favoriteWeekday")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A PEDIDO — aparece SOZINHO, uma vez, no início do ano seguinte
 * (janeiro), mostrando o resumo do ano que acabou de terminar — sem
 * entrada permanente em nenhum menu (decisão explícita: "só aparece
 * automaticamente no fim do período"). `localStorage` com o ANO na
 * chave — reaparece naturalmente no ano seguinte, sem precisar de
 * lógica extra pra "resetar".
 *
 * Janela: 1º de dezembro até 31 de janeiro do ano seguinte — cobre
 * tanto quem abre o app já em dezembro (resumo do ano corrente,
 * quase terminando) quanto janeiro (resumo do ano que acabou).
 */
export function YearInReviewModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reviewYear, setReviewYear] = useState<number | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Só pra teste — ?preview-year-in-review=2025 força a abertura
    // mostrando o resumo daquele ano, mesmo fora de dezembro/janeiro
    // e mesmo já tendo sido dispensado antes. Nunca afeta quem não
    // usa esse parâmetro na URL — comportamento real intocado.
    const previewYear = new URLSearchParams(window.location.search).get("preview-year-in-review");
    if (previewYear) {
      setReviewYear(Number(previewYear));
      setOpen(true);
      return;
    }

    const now = new Date();
    const month = now.getMonth(); // 0 = janeiro, 11 = dezembro
    if (month !== 11 && month !== 0) return; // só dezembro ou janeiro

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

  if (!open || reviewYear == null) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-background transition-opacity duration-200 ${mounted ? "opacity-100" : "opacity-0"}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex shrink-0 items-center justify-end p-4">
        <button type="button" onClick={handleClose} aria-label={t("social.close")} className="text-muted">
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      <YearInReviewContent year={reviewYear} />
    </div>
  );
}
