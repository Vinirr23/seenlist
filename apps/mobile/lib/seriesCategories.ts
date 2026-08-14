import type { LibraryItem } from "@seenlist/types";

export interface SeriesCategory {
  slug: string;
  /**
   * CORREÇÃO (a pedido — auditoria de tradução) — era `label: string`
   * com o texto em português direto, sem tradução nenhuma (esse
   * arquivo é um módulo de dados simples, sem acesso a `t()`).
   * Virou `labelKey`, uma chave — quem consome (`app/profile/series.tsx`,
   * `components/profile/PublicLibrarySection.tsx`) traduz com `t(category.labelKey)`
   * no próprio componente, onde `useTranslation()` está disponível.
   */
  labelKey: string;
  barColor: string;
  filter: (item: LibraryItem) => boolean;
}

/**
 * TASK-116 (correção — Perfil) — porta fiel de
 * `lib/series-categories.ts`. As cores são os valores hex EXATOS da
 * paleta padrão do Tailwind (`yellow-500`, `blue-500`, etc.) — não
 * são os tokens de tema do app (`colors.primary` etc.); é um sistema
 * de cor à parte, só pra essas 5 categorias, igual ao web.
 *
 * Ordem (a pedido, reorganizada): Assistindo, Assistir depois, Em
 * dia, Assistidas, Interrompidas — mesma ordem aplicada no web.
 */
export const SERIES_CATEGORIES: SeriesCategory[] = [
  { slug: "assistindo", labelKey: "seriesCategory.watching", barColor: "#eab308", filter: (i) => i.status === "watching" },
  {
    slug: "assistir-depois",
    labelKey: "seriesCategory.wantToWatch",
    barColor: "#a855f7",
    filter: (i) => i.status === "want_to_watch",
  },
  { slug: "em-dia", labelKey: "seriesCategory.upToDate", barColor: "#3b82f6", filter: (i) => i.status === "up_to_date" },
  { slug: "concluidas", labelKey: "seriesCategory.completed", barColor: "#22c55e", filter: (i) => i.status === "completed" },
  { slug: "pausadas", labelKey: "seriesCategory.paused", barColor: "#ef4444", filter: (i) => i.status === "paused" },
];
