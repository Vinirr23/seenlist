import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";

export default function ProfilePage() {
  return (
    <PageContainer>
      <ScreenHeader title="Perfil" description="Suas informações e estatísticas vão aparecer aqui." />
      <ProfileStats />
    </PageContainer>
  );
}
