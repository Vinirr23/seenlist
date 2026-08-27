import { PublicFavoriteSeriesPageView } from "@/components/social/PublicFavoriteSeriesPageView";

export default async function PublicFavoriteSeriesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PublicFavoriteSeriesPageView username={username} />;
}
