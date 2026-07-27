import type { useTranslation } from "./LocaleProvider";
import type { FeedCategoryKey } from "@/lib/queries/feed-categories";

/**
 * `FEED_CATEGORIES` (lib/queries/feed-categories.ts) é usada pra
 * onboarding do Feed e pra tela de assuntos em Configurações — o
 * `label` de cada categoria está fixo em português. Mesma estratégia
 * de `dayLabels.ts`/`seriesCategoryLabels.ts`: traduz na borda de
 * exibição, por key, sem mexer na lista original.
 */
const CATEGORY_LABEL_KEYS: Record<FeedCategoryKey, string> = {
  series: "feedCategory.series",
  filmes: "feedCategory.movies",
  anime: "feedCategory.anime",
  kdrama: "feedCategory.kdrama",
  marvel: "feedCategory.marvel",
  dc: "feedCategory.dc",
  star_wars: "feedCategory.starWars",
  harry_potter: "feedCategory.harryPotter",
  scifi: "feedCategory.scifi",
  terror: "feedCategory.horror",
  romance: "feedCategory.romance",
  comedia: "feedCategory.comedy",
  suspense: "feedCategory.thriller",
  misterio: "feedCategory.mystery",
  drama: "feedCategory.drama",
  documentarios: "feedCategory.documentaries",
  reality: "feedCategory.reality",
  animacoes: "feedCategory.animation",
  fantasia: "feedCategory.fantasy",
};

export function translateFeedCategoryLabel(key: FeedCategoryKey, t: ReturnType<typeof useTranslation>["t"]): string {
  return t(CATEGORY_LABEL_KEYS[key]);
}
