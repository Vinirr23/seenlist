import { PublicFavoriteMoviesPageView } from "@/components/social/PublicFavoriteMoviesPageView";

export default async function PublicFavoriteMoviesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PublicFavoriteMoviesPageView username={username} />;
}
