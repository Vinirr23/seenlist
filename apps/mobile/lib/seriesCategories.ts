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

/**
 * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15, reportado — "no web, ao
 * colocar uma série em 'assistir depois' fica da cor certa do status,
 * no mobile não está") — item pendente desde 2026-09-10. `SERIES_CATEGORIES`
 * em si sempre esteve correto (cores batendo com o web); o problema é
 * que NENHUM lugar do mobile que desenha a cor de status (barra de
 * progresso do topo em `SeriesHeader.tsx`, porcentagem/barra/selo de
 * temporada em `SeasonAccordion.tsx`, botões redondos de "assistido"
 * em `EpisodeWatchedButton.tsx` via `EpisodeCarousel.tsx`/
 * `SeasonAccordion.tsx`) nunca recebia a categoria da série — todos
 * usavam `colors.primary` (âmbar) direto, sempre, em vez da cor da
 * categoria atual. O web resolve isso com `getSeriesCategoryByStatus`
 * + `colorClass`, calculado uma vez em `SeriesDetailsView.tsx` e
 * repassado pra baixo — este helper é o equivalente mobile (retorna o
 * HEX de `barColor` em vez de uma classe Tailwind, já que o mobile não
 * usa Tailwind).
 */
export function getSeriesCategoryColorByStatus(status: string | null | undefined): string | undefined {
  if (!status) return undefined;
  return SERIES_CATEGORIES.find((category) => category.filter({ status } as never))?.barColor;
}
