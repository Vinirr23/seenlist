import type { useTranslation } from "./LocaleProvider";

/**
 * `formatDayLabel` (lib/upcomingEpisodes.ts) devolve o label já
 * formatado em português fixo ("HOJE", "AMANHÃ", dia da semana,
 * "DEPOIS") — histórico de antes do sistema de tradução existir.
 * Mesma estratégia do web (`apps/web/lib/i18n/dayLabels.ts`): traduz
 * o RESULTADO na borda de exibição, sem mexer na lógica de
 * agrupamento (mesma que resolve o bug real de "SEXTA ambíguo" já
 * documentado ali).
 */
const DAY_LABEL_KEYS: Record<string, string> = {
  HOJE: "emBreve.today",
  AMANHÃ: "emBreve.tomorrow",
  DOMINGO: "emBreve.sunday",
  SEGUNDA: "emBreve.monday",
  TERÇA: "emBreve.tuesday",
  QUARTA: "emBreve.wednesday",
  QUINTA: "emBreve.thursday",
  SEXTA: "emBreve.friday",
  SÁBADO: "emBreve.saturday",
  DEPOIS: "emBreve.later",
};

export function translateDayLabel(label: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const key = DAY_LABEL_KEYS[label];
  return key ? t(key) : label;
}
