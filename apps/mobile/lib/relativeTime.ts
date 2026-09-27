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

/**
 * A PEDIDO (2026-09-22, "Continue de onde parou" — indicador de "há
 * quanto tempo" na seção "Faz um tempo que você não assiste") — função
 * NOVA, separada de `formatRelativeTime` acima de propósito: aquela
 * função corta em 7 dias e devolve `null` por decisão explícita já
 * documentada (ver comentário dela e o espelho em
 * `apps/web/lib/relativeTime.ts`: "não faz sentido dizer 'há 23 dias',
 * uma data vira mais clara") — pensada pro Feed, onde os posts raramente
 * passam de alguns dias. Reaproveitar/alargar aquele corte quebraria
 * esse comportamento já calibrado em todo lugar que já usa a função.
 *
 * Esta série de itens, por definição, NUNCA aparece antes de 14 dias
 * (é o próprio corte que a separa de "Continue assistindo" —
 * `STALE_AFTER_DAYS` em `series/index.tsx`) e sai da lista de vez
 * depois de 30 dias (vira "Pausada" sozinha, ver `daily-status-
 * recalc`) — a faixa de uso real é só semanas, quase nunca meses.
 * Arredondado pra semana/mês (não dia) de propósito: "há 3 semanas" é
 * uma frase natural; "há 23 dias" não é — mesmo raciocínio da função
 * acima, só que a granularidade certa pra ESTA faixa de tempo é
 * diferente.
 */
const STALE_LABELS: Record<Locale, { week: (n: number) => string; month: (n: number) => string }> = {
  "pt-BR": {
    week: (n) => `há ${n} ${n === 1 ? "semana" : "semanas"}`,
    month: (n) => `há ${n} ${n === 1 ? "mês" : "meses"}`,
  },
  en: {
    week: (n) => `${n}w ago`,
    month: (n) => `${n}mo ago`,
  },
  es: {
    week: (n) => `hace ${n} ${n === 1 ? "semana" : "semanas"}`,
    month: (n) => `hace ${n} ${n === 1 ? "mes" : "meses"}`,
  },
};

export function formatStaleSince(dateIso: string, now: number, locale: Locale): string {
  const diffMs = Math.max(0, now - new Date(dateIso).getTime());
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const labels = STALE_LABELS[locale] ?? STALE_LABELS["pt-BR"];

  if (diffDays < 30) {
    return labels.week(Math.max(1, Math.round(diffDays / 7)));
  }
  return labels.month(Math.max(1, Math.round(diffDays / 30)));
}

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
