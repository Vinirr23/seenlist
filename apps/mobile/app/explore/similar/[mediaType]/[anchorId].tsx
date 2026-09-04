import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { DiscoverGridScreen } from "@/components/explore/DiscoverGridScreen";
import { useDiscoverSimilarInfinite } from "@/lib/useDiscoverList";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { highlightTitle } from "@/lib/i18n/highlightTitle";
import type { SimilarDiscoverKey } from "@/lib/discover";

/**
 * PORTE DO WEB (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile, não assuma nada") —
 * versão RN de
 * `apps/web/app/(main)/explore/similar/[mediaType]/[anchorId]/page.tsx`.
 * Aberta pela seta de "Porque você assistiu a [X]"
 * (`ExploreMoviesTab.tsx`/`ExploreSeriesTab.tsx`), que já manda o
 * título da âncora pronto na própria URL (`?title=`) — mesmo motivo
 * do web pra não recalcular via `useAnchorTitle` aqui: evita mostrar
 * um título diferente do carrossel que a pessoa realmente clicou, se
 * a Biblioteca mudar entre um render e outro.
 *
 * `title` NÃO é decodificado manualmente aqui de propósito — o
 * próprio `useLocalSearchParams` do expo-router (linking do React
 * Navigation por baixo) já decodifica query params sozinho, do
 * mesmo jeito que qualquer parser de URL padrão faz; chamar
 * `decodeURIComponent` de novo por cima decodificaria em dobro e
 * corromperia título com "%"/"&" no meio. Não deu pra confirmar isso
 * direto no código-fonte instalado nesta sessão (sem acesso ao
 * `node_modules` do projeto por aqui) — se o título aparecer errado
 * no teste no emulador (ex. "%20" no lugar de espaço), é o primeiro
 * lugar pra olhar.
 */
export default function ExploreSimilarScreen() {
  const { mediaType, anchorId, title } = useLocalSearchParams<{ mediaType: string; anchorId: string; title?: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const isValidMediaType = mediaType === "movie" || mediaType === "series";
  const parsedAnchorId = Number(anchorId);
  const isValidAnchorId = Number.isInteger(parsedAnchorId) && parsedAnchorId > 0;
  const isValid = isValidMediaType && isValidAnchorId;

  useEffect(() => {
    if (!isValid) router.back();
  }, [isValid, router]);

  const kind: SimilarDiscoverKey = mediaType === "series" ? "similar_series" : "similar_movies";
  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useDiscoverSimilarInfinite(
    kind,
    isValid ? parsedAnchorId : null
  );

  if (!isValid) return null;

  const anchorTitle = typeof title === "string" && title.length > 0 ? title : null;

  return (
    <DiscoverGridScreen
      title={anchorTitle ? highlightTitle(t("explore.discover.becauseYouWatched"), anchorTitle) : "…"}
      items={items}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      hasNextPage={hasNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}
