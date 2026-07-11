"use client";

import type { MovieDetails } from "@seenlist/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { MetaRow } from "../media/MetaRow";

const LANGUAGE_KEYS: Record<string, string> = {
  en: "lang.en",
  pt: "lang.pt",
  es: "lang.es",
  fr: "lang.fr",
  ja: "lang.ja",
  ko: "lang.ko",
  de: "lang.de",
  it: "lang.it",
  zh: "lang.zh",
};

export function MovieInfo({ movie }: { movie: MovieDetails }) {
  const { t, locale } = useTranslation();
  const currencyFormatter = new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-text">{movie.overview || t("series.noOverview")}</p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <MetaRow label={t("movie.director")} value={movie.director ?? "—"} />
        <MetaRow label={t("movie.studios")} value={movie.studios.join(", ") || "—"} />
        <MetaRow label={t("movie.country")} value={movie.country ?? "—"} />
        <MetaRow
          label={t("movie.language")}
          value={
            movie.language && LANGUAGE_KEYS[movie.language]
              ? t(LANGUAGE_KEYS[movie.language] as string)
              : (movie.language ?? "—")
          }
        />
        {movie.budget !== null && <MetaRow label={t("movie.budget")} value={currencyFormatter.format(movie.budget)} />}
        {movie.revenue !== null && (
          <MetaRow label={t("movie.revenue")} value={currencyFormatter.format(movie.revenue)} />
        )}
      </dl>
    </div>
  );
}
