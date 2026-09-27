import type { Locale } from "./i18n/translations";
import { INTL_LOCALES } from "./i18n/translations";

/**
 * A PEDIDO — "Feed mais vivo", item 3. Usa `Intl.RelativeTimeFormat`
 * (API nativa do navegador, sem dependência nova) — já resolve
 * plural e tradução certos pros 3 idiomas sozinho (pt-BR: "há 5
 * minutos"/"há 1 minuto"; en: "5 minutes ago"; es: "hace 5 minutos"),
 * sem precisar de uma chave de tradução pra cada variação de número.
 *
 * Retorna `null` quando o post é antigo o suficiente (7+ dias) — o
 * chamador cai pra formatação de data absoluta que já existia antes
 * (não faz sentido dizer "há 23 dias", uma data vira mais clara).
 */
/**
 * A PEDIDO (2026-09-22, "Continue de onde parou" — indicador de "há
 * quanto tempo" na seção "Faz um tempo que você não assiste") — função
 * NOVA, separada de `formatRelativeTime` acima de propósito: o corte
 * de 7 dias/`null` daquela função é uma decisão já documentada
 * ("não faz sentido dizer 'há 23 dias', uma data vira mais clara"),
 * pensada pro Feed — reaproveitar/alargar aquele corte mudaria o
 * comportamento já calibrado em todo lugar que já a usa.
 *
 * Esta lista, por definição, nunca aparece antes de 14 dias (é o
 * próprio corte que a separa de "Continue assistindo" —
 * `STALE_AFTER_DAYS` em `continueWatchingSeries.ts`) e some de vez
 * depois de 30 (vira "Pausada" sozinha, ver `daily-status-recalc`) —
 * a faixa real de uso é semanas, quase nunca meses. `unit: "week"`/
 * `"month"` em vez de `"day"` de propósito: "há 3 semanas" é uma
 * frase natural pro `Intl.RelativeTimeFormat` produzir; "há 23 dias"
 * não é — mesmo raciocínio de cima, só que a granularidade certa pra
 * ESTA faixa de tempo é diferente.
 */
export function formatStaleSince(dateIso: string, now: number, locale: Locale): string {
  const diffMs = Math.max(0, now - new Date(dateIso).getTime());
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: "auto" });

  if (diffDays < 30) {
    return rtf.format(-Math.max(1, Math.round(diffDays / 7)), "week");
  }
  return rtf.format(-Math.max(1, Math.round(diffDays / 30)), "month");
}

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
