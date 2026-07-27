import type { useTranslation } from "./LocaleProvider";

/**
 * `useUpcomingEpisodes` (lib/queries/upcoming-episodes.ts) devolve
 * `group.label` já formatado em português fixo ("HOJE", "AMANHÃ",
 * nome do dia da semana, "DEPOIS") — histórico da tarefa que criou
 * isso, antes do sistema de tradução existir. Em vez de reescrever a
 * lógica de agrupamento (arriscado, é a mesma que corrige o bug real
 * de "SEXTA ambíguo" já documentado ali), só traduz o RESULTADO aqui,
 * na borda de exibição — usado pelos dois "Em breve" (séries e
 * filmes) e por `StatsSeriesTab`.
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
