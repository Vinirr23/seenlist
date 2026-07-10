import { GroupDetailView } from "@/components/explore/GroupDetailView";

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GroupDetailView slug={slug} />;
}
