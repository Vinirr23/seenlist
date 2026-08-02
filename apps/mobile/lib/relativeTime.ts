import type { Locale } from "./i18n/translations";
import { INTL_LOCALES } from "./i18n/translations";

/**
 * A PEDIDO — "Feed mais vivo", item 3. Porta fiel de
 * `apps/web/lib/relativeTime.ts` — usa `Intl.RelativeTimeFormat`
 * (já disponível no motor JS do React Native/Hermes, sem lib nova),
 * resolve plural e tradução certos pros 3 idiomas sozinho.
 *
 * Retorna `null` quando o post é antigo o suficiente (7+ dias) — o
 * chamador cai pra formatação de data absoluta que já existia antes.
 */
export function formatRelativeTime(dateIso: string, now: number, locale: Locale, justNowLabel: string): string | null {
  const diffMs = now - new Date(dateIso).getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 60) return justNowLabel;

  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: "auto" });

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return rtf.format(-diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return rtf.format(-diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return rtf.format(-diffDays, "day");

  return null;
}
