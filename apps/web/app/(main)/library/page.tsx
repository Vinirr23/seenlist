import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { LibraryView } from "@/components/library/LibraryView";

export default function LibraryPage() {
  return (
    <PageContainer>
      <ScreenHeader title="Minha Lista" description="Tudo que você está acompanhando." />
      <LibraryView />
    </PageContainer>
  );
}
