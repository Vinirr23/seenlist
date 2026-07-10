import { PostCommentDetailView } from "@/components/explore/PostCommentDetailView";

export default async function PostCommentPage({
  params,
}: {
  params: Promise<{ id: string; commentId: string }>;
}) {
  const { id, commentId } = await params;
  return <PostCommentDetailView postId={id} commentId={commentId} />;
}
