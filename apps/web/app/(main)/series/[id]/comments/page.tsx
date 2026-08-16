import { CommentsPageView } from "@/components/social/CommentsPageView";
import { getSeriesSummary } from "@/lib/tmdb/client";
import { getServerLocale, translateServer } from "@/lib/i18n/serverLocale";

/**
 * A PEDIDO — a seção de review em texto (dentro de Comentários
 * agora) precisa de título+pôster pra montar o card de "publicar no
 * Feed". Busca no SERVIDOR (função já existente, leve — só resumo,
 * não os detalhes completos) — se falhar (TMDB fora do ar, raro),
 * cai pra `undefined` e a seção de review-texto simplesmente não
 * aparece; os comentários continuam funcionando normalmente.
 */
export default async function SeriesCommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getServerLocale();
  const media = await getSeriesSummary(Number(id), locale)
    .then((summary) => ({ type: "series" as const, title: summary.title, posterPath: summary.posterPath }))
    .catch(() => undefined);

  return (
    <CommentsPageView
      backHref={`/series/${id}`}
      title={translateServer(locale, "reviews.title")}
      target={{ mediaType: "series", mediaId: Number(id) }}
      media={media}
    />
  );
}
