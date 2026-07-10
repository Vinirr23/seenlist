import { SectionPageHeader } from "./SectionPageHeader";
import { ProfileSeriesSection } from "./ProfileSeriesSection";

export function ProfileSeriesPageView() {
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title="Séries" />
      <ProfileSeriesSection />
    </div>
  );
}
