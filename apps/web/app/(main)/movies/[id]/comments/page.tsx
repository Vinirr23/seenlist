import { CommentsPageView } from "@/components/social/CommentsPageView";
import { getMovieSummary } from "@/lib/tmdb/client";

export default async function MovieCommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await getMovieSummary(Number(id))
    .then((summary) => ({ type: "movie" as const, title: summary.title, posterPath: summary.posterPath }))
    .catch(() => undefined);

  return (
    <CommentsPageView
      backHref={`/movies/${id}`}
      title="Avaliações"
      target={{ mediaType: "movie", mediaId: Number(id) }}
      media={media}
    />
  );
}
