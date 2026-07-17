import type { LibraryItem } from "@seenlist/types";

export interface SeriesCategory {
  slug: string;
  label: string;
  barColorClass: string;
  filter: (item: LibraryItem) => boolean;
}

/**
 * Ordem (a pedido, reorganizada): Assistindo, Assistir depois, Em
 * dia, Assistidas, Interrompidas. TASK-033 — "Em dia" deixou de ser
 * um flag calculado na leitura (isCaughtUp, removido); agora é o
 * status "up_to_date" de verdade, decidido e gravado pelo
 * importador. "Assistindo" não precisa mais excluir nada — os dois
 * nunca se sobrepõem, são status distintos.
 */
export const SERIES_CATEGORIES: SeriesCategory[] = [
  {
    slug: "assistindo",
    label: "Assistindo",
    barColorClass: "bg-yellow-500",
    filter: (i) => i.status === "watching",
  },
  {
    slug: "assistir-depois",
    label: "Assistir depois",
    barColorClass: "bg-purple-500",
    filter: (i) => i.status === "want_to_watch",
  },
  {
    slug: "em-dia",
    label: "Em dia",
    barColorClass: "bg-blue-500",
    filter: (i) => i.status === "up_to_date",
  },
  {
    slug: "concluidas",
    label: "Assistidas",
    barColorClass: "bg-green-500",
    filter: (i) => i.status === "completed",
  },
  { slug: "pausadas", label: "Interrompidas", barColorClass: "bg-red-500", filter: (i) => i.status === "paused" },
];

export function getSeriesCategoryBySlug(slug: string): SeriesCategory | undefined {
  return SERIES_CATEGORIES.find((category) => category.slug === slug);
}

/**
 * TASK-045 — a tela de episódios usa `LibraryStatus` (watching/
 * up_to_date/etc), não o slug da categoria — helper direto por
 * status, pra não duplicar o mapeamento em mais um lugar. Reaproveita
 * a MESMA fonte (`SERIES_CATEGORIES`) que a Biblioteca já usa — muda
 * a cor num lugar só, reflete em todo canto.
 */
export function getSeriesCategoryByStatus(status: string): SeriesCategory | undefined {
  return SERIES_CATEGORIES.find((category) => category.filter({ status } as never));
}

/** `bg-yellow-500` → `text-yellow-500` — mesma paleta, variante de texto (percentual, ícone de check etc.). */
export function barColorClassToTextColorClass(barColorClass: string): string {
  return barColorClass.replace(/^bg-/, "text-");
}
