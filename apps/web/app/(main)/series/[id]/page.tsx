import { SeriesDetailsView } from "@/components/series/SeriesDetailsView";

export default async function SeriesDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SeriesDetailsView seriesId={id} />;
}
