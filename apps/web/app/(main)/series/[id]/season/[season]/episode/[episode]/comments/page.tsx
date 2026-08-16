import { CommentsPageView } from "@/components/social/CommentsPageView";
import { getServerLocale, translateServer } from "@/lib/i18n/serverLocale";

export default async function EpisodeCommentsPage({
  params,
}: {
  params: Promise<{ id: string; season: string; episode: string }>;
}) {
  const { id, season, episode } = await params;
  const locale = await getServerLocale();
  const seriesIdNum = Number(id);
  const seasonNum = Number(season);
  const episodeNum = Number(episode);

  return (
    <CommentsPageView
      backHref={`/series/${id}/season/${season}/episode/${episode}`}
      title={translateServer(locale, "profile.comments")}
      target={{
        mediaType: "series",
        mediaId: seriesIdNum,
        seasonNumber: seasonNum,
        episodeNumber: episodeNum,
      }}
    />
  );
}
