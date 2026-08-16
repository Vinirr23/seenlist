import { CommentsPageView } from "@/components/social/CommentsPageView";
import { getMovieSummary } from "@/lib/tmdb/client";
import { getServerLocale, translateServer } from "@/lib/i18n/serverLocale";

export default async function MovieCommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getServerLocale();
  const media = await getMovieSummary(Number(id), locale)
    .then((summary) => ({ type: "movie" as const, title: summary.title, posterPath: summary.posterPath }))
    .catch(() => undefined);

  return (
    <CommentsPageView
      backHref={`/movies/${id}`}
      title={translateServer(locale, "reviews.title")}
      target={{ mediaType: "movie", mediaId: Number(id) }}
      media={media}
    />
  );
}
