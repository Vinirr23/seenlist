import { ListDetailView } from "@/components/profile/ListDetailView";

export default async function ProfileListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListDetailView listId={id} />;
}
