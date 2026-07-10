import { ProfileSeriesCategoryView } from "@/components/profile/ProfileSeriesCategoryView";

export default async function ProfileSeriesCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProfileSeriesCategoryView slug={slug} />;
}
