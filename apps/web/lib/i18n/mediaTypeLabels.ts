import type { MediaType } from "@seenlist/types";
import type { useTranslation } from "./LocaleProvider";

/**
 * `MEDIA_TYPE_LABEL` (lib/media-labels.ts) é usado em mais de uma
 * tela (Busca, Biblioteca) e guarda "Filme"/"Série" em português
 * fixo. Mesmo padrão dos outros helpers de tradução por lookup.
 * Nota: só aplicado em `search/MediaCard.tsx` por enquanto —
 * `library/LibraryCard.tsx` ainda precisa do mesmo tratamento quando
 * a área de Biblioteca for traduzida.
 */
export function translateMediaType(mediaType: MediaType, t: ReturnType<typeof useTranslation>["t"]): string {
  return mediaType === "movie" ? t("media.movie") : t("media.series");
}
