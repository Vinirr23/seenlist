import { CommentsPageView } from "@/components/social/CommentsPageView";

export default async function EpisodeCommentsPage({
  params,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
}) {
  const { id, season, episode } = await params;
  const seriesIdNum = Number(id);
  const seasonNum = Number(season);
  const episodeNum = Number(episode);

  return (
    <CommentsPageView
      backHref={`/series/${id}/season/${season}/episode/${episode}`}
      title="Comentários"
      target={{
        mediaType: "series",
        mediaId: seriesIdNum,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
      }}
      episodeSpoilerContext={{ seriesId: seriesIdNum, seasonNumber: seasonNum, episodeNumber: episodeNum }}
    />
  );
}
