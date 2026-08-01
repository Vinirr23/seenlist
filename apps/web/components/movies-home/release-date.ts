/**
 * Porta fiel de `apps/mobile/app/(tabs)/movies.tsx` (TASK-148) — a
 * pedido, replicando no web o mesmo comportamento que já existia só
 * no app nativo: filme "Assistir depois" com lançamento no futuro
 * sai da lista principal e vai pra "Em breve" automaticamente.
 */

import type { Locale } from "@/lib/i18n/translations";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/** Data de hoje no fuso local, formato TMDB (YYYY-MM-DD) — não usa `toISOString()` de propósito (isso converteria pra UTC, podendo voltar um dia pra quem está a oeste de Greenwich). */
export function todayLocalKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isReleased(releaseDate: string | null | undefined, todayKey: string): boolean {
  if (!releaseDate) return true; // sem data conhecida — trata como já lançado, mesmo padrão de "year: null" já usado no resto do app.
  return releaseDate <= todayKey;
}

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function upcomingLabel(releaseDate: string, todayKey: string, t: TFunction, locale: Locale): string {
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${releaseDate}T00:00:00`);
  const daysUntil = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (daysUntil === 0) return t("moviesHome.releasesToday");
  if (daysUntil === 1) return t("moviesHome.releasesTomorrow");
  if (daysUntil <= 30) return t("moviesHome.releasesInDays", { days: daysUntil });
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "long", year: "numeric" });
  return t("moviesHome.releasesOn", { date: dateFormatter.format(target) });
}
