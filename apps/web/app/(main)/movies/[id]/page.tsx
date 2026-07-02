import { MovieDetailsView } from "@/components/movie/MovieDetailsView";

export default async function MovieDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MovieDetailsView movieId={id} />;
}
