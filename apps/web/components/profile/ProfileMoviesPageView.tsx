import { SectionPageHeader } from "./SectionPageHeader";
import { ProfileMoviesSection } from "./ProfileMoviesSection";

export function ProfileMoviesPageView() {
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title="Filmes" />
      <ProfileMoviesSection />
    </div>
  );
}
