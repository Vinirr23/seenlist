import { CommentsPageView } from "@/components/social/CommentsPageView";

export default async function SeriesCommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CommentsPageView
      backHref={`/series/${id}`}
      title="Comentários"
      target={{ mediaType: "series", mediaId: Number(id) }}
    />
  );
}
