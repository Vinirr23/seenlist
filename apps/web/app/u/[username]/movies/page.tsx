import { PublicMoviesPageView } from "@/components/social/PublicMoviesPageView";

export default async function PublicMoviesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PublicMoviesPageView username={username} />;
}
