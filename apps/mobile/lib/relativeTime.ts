import type { Locale } from "./i18n/translations";

/**
 * A PEDIDO — "Feed mais vivo", item 3. Porta fiel de
 * `apps/web/lib/relativeTime.ts` — no navegador usa
 * `Intl.RelativeTimeFormat` sem problema nenhum (suporte garantido
 * em qualquer navegador moderno).
 *
 * CORREÇÃO (bug real, achado via pilha de componentes — crash
 * confirmado no Feed, "Cannot read property 'prototype' of
 * undefined" dentro do `PostCard`) — a versão nativa usava
 * `Intl.RelativeTimeFormat` também, chamada sem nenhuma proteção,
 * TODA vez que um post renderiza. O motor Hermes (usado pelo React
 * Native) só inclui suporte a essa API específica se o build nativo
 * tiver sido compilado com os dados de ICU completos — em builds sem
 * isso, `Intl.RelativeTimeFormat` fica `undefined`, e `new
 * Intl.RelativeTimeFormat(...)` explode com exatamente esse erro
 * ("tentar ler `.prototype` de algo que não existe" é o que o motor
 * faz por baixo do capô ao instanciar algo indefinido com `new`).
 * `Intl.DateTimeFormat` (usado em outro lugar do mesmo arquivo,
 * `PostCard.tsx`) é mais básico e não teve o mesmo problema — daí o
 * crash ser consistente, mas só nessa função específica.
 *
 * Corrigido formatando à mão, sem depender de nenhuma API do `Intl`
 * — nunca mais tem risco de faltar suporte no motor JS, em nenhum
 * aparelho, banda de ICU incluída ou não.
 *
 * Retorna `null` quando o post é antigo o suficiente (7+ dias) — o
 * chamador cai pra formatação de data absoluta que já existia antes.
 */
const LABELS: Record<Locale, { minute: (n: number) => string; hour: (n: number) => string; day: (n: number) => string }> = {
  "pt-BR": {
    minute: (n) => `há ${n} min`,
    hour: (n) => `há ${n} h`,
    day: (n) => `há ${n} ${n === 1 ? "dia" : "dias"}`,
  },
  en: {
    minute: (n) => `${n}m ago`,
    hour: (n) => `${n}h ago`,
    day: (n) => `${n}d ago`,
  },
  es: {
    minute: (n) => `hace ${n} min`,
    hour: (n) => `hace ${n} h`,
    day: (n) => `hace ${n} ${n === 1 ? "día" : "días"}`,
  },
};

export function formatRelativeTime(dateIso: string, now: number, locale: Locale, justNowLabel: string): string | null {
  const diffMs = now - new Date(dateIso).getTime();
  const diffSeconds = Math.round(diffMs / 1000);

  if (diffSeconds < 60) return justNowLabel;

  const labels = LABELS[locale] ?? LABELS["pt-BR"];

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return labels.minute(diffMinutes);

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return labels.hour(diffHours);

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return labels.day(diffDays);

  return null;
}
