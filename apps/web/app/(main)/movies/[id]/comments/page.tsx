import { CommentsPageView } from "@/components/social/CommentsPageView";

export default async function MovieCommentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <CommentsPageView
      backHref={`/movies/${id}`}
      title="Comentários"
      target={{ mediaType: "movie", mediaId: Number(id) }}
    />
  );
}
