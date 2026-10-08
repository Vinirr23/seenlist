/**
 * A PEDIDO (2026-10-08 — "preciso que o perfil fique compartilhável
 * nas redes sociais igual ao Bingers") — versão SEM i18n de
 * `formatWatchDuration` (`lib/format-duration.ts`), pro card de
 * compartilhamento (Open Graph) e a imagem gerada dele
 * (`app/u/[username]/opengraph-image.tsx`), que rodam fora de
 * qualquer componente React — não tem como chamar o hook de tradução
 * (`useTranslation`) ali. Mesma cascata de unidades (anos → meses →
 * dias → horas), só que sempre em pt-BR: o resto do card de
 * compartilhamento (legenda, "assistidos", etc.) também é fixo em
 * pt-BR por enquanto, já que não existe um jeito de saber o idioma de
 * quem vai VER o link compartilhado (é lido por um crawler do
 * WhatsApp/Threads/etc, não por uma sessão de usuário com idioma
 * escolhido).
 */
export function formatWatchMinutesPlain(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0h";

  const totalHours = Math.round(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  const years = Math.floor(totalDays / 365);
  const remDaysAfterYears = totalDays % 365;
  const months = Math.floor(remDaysAfterYears / 30);
  const days = remDaysAfterYears % 30;

  if (years > 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  if (months > 0) return `${months} ${months === 1 ? "mês" : "meses"}${days > 0 ? ` ${days}d` : ""}`;
  if (totalDays > 0) return `${totalDays}d${remHours > 0 ? ` ${remHours}h` : ""}`;
  return `${totalHours}h`;
}
