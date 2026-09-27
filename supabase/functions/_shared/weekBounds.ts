// supabase/functions/_shared/weekBounds.ts
//
// Extraído de `week-review-pregenerate/index.ts` (rodada 29, 2026-09-23)
// quando a notificação push de domingo (`week-review-notify`) passou a
// precisar EXATAMENTE da mesma janela de semana que o job de
// pré-geração usa — sem isso, os dois jobs podiam calcular limites de
// semana levemente diferentes (por exemplo se alguém ajustasse só um
// dos dois no futuro), e `week-review-notify` deixaria de encontrar as
// linhas que `week-review-pregenerate` acabou de gravar.
//
// FUSO HORÁRIO (decisão confirmada com o usuário via `AskUserQuestion`,
// rodada 27) — a semana de calendário "de verdade" (a que
// `computeWeekHighlight`, em `apps/mobile/lib/weekHighlight.ts`, usa)
// é calculada na hora LOCAL do aparelho. Estas Edge Functions rodam no
// SERVIDOR, que não tem como saber o fuso de cada usuário (não existe
// coluna de timezone no banco). Decisão: assumir Brasília (UTC-3, sem
// horário de verão — extinto no Brasil desde 2019) pra todo mundo. Se
// isso um dia importar de verdade, a correção é guardar o fuso de cada
// usuário — não assumir, perguntar antes.

const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Segunda 00:00 até a próxima segunda 00:00 (exclusivo), em Brasília,
 * pra semana de calendário que contém `referenceDate`.
 */
export function getBrasiliaCalendarWeekBounds(referenceDate: Date = new Date()): { start: Date; end: Date } {
  // Desloca o instante UTC pra os getters UTC lerem o relógio de
  // Brasília — truque padrão pra fazer contas de fuso sem depender do
  // fuso do próprio servidor (Supabase roda em UTC).
  const shifted = new Date(referenceDate.getTime() - BRASILIA_OFFSET_MS);
  const day = shifted.getUTCDay(); // 0 = domingo, 1 = segunda, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const mondayShifted = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + diffToMonday, 0, 0, 0, 0),
  );
  // Desfaz o deslocamento — volta pro instante UTC real.
  const start = new Date(mondayShifted.getTime() + BRASILIA_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}
