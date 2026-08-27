import { PublicSeriesPageView } from "@/components/social/PublicSeriesPageView";

export default async function PublicSeriesPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PublicSeriesPageView username={username} />;
}
