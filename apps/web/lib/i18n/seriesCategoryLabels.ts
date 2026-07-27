import type { useTranslation } from "./LocaleProvider";

/**
 * `SERIES_CATEGORIES` (lib/series-categories.ts) é compartilhada por
 * várias telas (Biblioteca, Perfil, perfil público) e guarda o
 * `label` em português fixo — criado antes do sistema de tradução
 * existir. Mesma estratégia de `dayLabels.ts`: traduz na borda de
 * exibição, por slug, sem mexer na lista original (que várias telas
 * ainda usam por igual).
 *
 * Nota: só aplicado aqui (Feed/social — perfil público) por enquanto.
 * As outras telas que também renderizam `category.label`
 * (Biblioteca, Perfil) ainda precisam do mesmo tratamento quando
 * essas áreas forem traduzidas.
 */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  assistindo: "seriesCategory.watching",
  "assistir-depois": "seriesCategory.wantToWatch",
  "em-dia": "seriesCategory.upToDate",
  concluidas: "seriesCategory.completed",
  pausadas: "seriesCategory.paused",
};

export function translateCategoryLabel(slug: string, label: string, t: ReturnType<typeof useTranslation>["t"]): string {
  const key = CATEGORY_LABEL_KEYS[slug];
  return key ? t(key) : label;
}
