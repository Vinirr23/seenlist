"use client";

import { SectionPageHeader } from "./SectionPageHeader";
import { ProfileMoviesSection } from "./ProfileMoviesSection";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function ProfileMoviesPageView() {
  const { t } = useTranslation();
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title={t("nav.movies")} />
      <ProfileMoviesSection />
    </div>
  );
}
