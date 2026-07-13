import type { LibraryItem } from "@seenlist/types";

export interface SeriesCategory {
  slug: string;
  label: string;
  barColor: string;
  filter: (item: LibraryItem) => boolean;
}

/**
 * TASK-116 (correção — Perfil) — porta fiel de
 * `lib/series-categories.ts`. As cores são os valores hex EXATOS da
 * paleta padrão do Tailwind (`yellow-500`, `blue-500`, etc.) — não
 * são os tokens de tema do app (`colors.primary` etc.); é um sistema
 * de cor à parte, só pra essas 5 categorias, igual ao web.
 */
export const SERIES_CATEGORIES: SeriesCategory[] = [
  { slug: "assistindo", label: "Assistindo", barColor: "#eab308", filter: (i) => i.status === "watching" },
  { slug: "em-dia", label: "Em dia", barColor: "#3b82f6", filter: (i) => i.status === "up_to_date" },
  { slug: "assistir-depois", label: "Assistir depois", barColor: "#a855f7", filter: (i) => i.status === "want_to_watch" },
  { slug: "pausadas", label: "Interrompidas", barColor: "#ef4444", filter: (i) => i.status === "paused" },
  { slug: "concluidas", label: "Assistidas", barColor: "#22c55e", filter: (i) => i.status === "completed" },
];

export function getSeriesCategoryBySlug(slug: string): SeriesCategory | undefined {
  return SERIES_CATEGORIES.find((c) => c.slug === slug);
}
