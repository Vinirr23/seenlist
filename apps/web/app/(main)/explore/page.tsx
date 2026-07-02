import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ExploreSearch } from "@/components/search/ExploreSearch";

export default function ExplorePage() {
  return (
    <PageContainer>
      <ScreenHeader title="Explorar" description="Pesquise filmes e séries." />
      <ExploreSearch />
    </PageContainer>
  );
}
