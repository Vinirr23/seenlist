import { CommentsPageView } from "@/components/social/CommentsPageView";
import { getSeriesSummary } from "@/lib/tmdb/client";

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
  const media = await getSeriesSummary(Number(id))
    .then((summary) => ({ type: "series" as const, title: summary.title, posterPath: summary.posterPath }))
    .catch(() => undefined);

  return (
    <CommentsPageView
      backHref={`/series/${id}`}
      title="Avaliações"
      target={{ mediaType: "series", mediaId: Number(id) }}
      media={media}
    />
  );
}
