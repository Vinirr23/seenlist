import { EpisodeDetailView } from "@/components/episode/EpisodeDetailView";

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
}) {
  const { id, season, episode } = await params;
  return <EpisodeDetailView seriesId={id} season={Number(season)} episode={Number(episode)} />;
}
