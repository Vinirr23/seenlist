"use client";

import { SectionPageHeader } from "./SectionPageHeader";
import { ListsView } from "./ListsView";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function ListsPageView() {
  const { t } = useTranslation();
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title={t("profile.section.lists")} />
      <ListsView />
    </div>
  );
}
