import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ProfileView } from "@/components/profile/ProfileView";

export default function ProfilePage() {
  return (
    <PageContainer>
      <ScreenHeader title="Perfil" />
      <ProfileView />
    </PageContainer>
  );
}
