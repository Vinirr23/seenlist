"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { LibraryView } from "@/components/library/LibraryView";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export default function LibraryPage() {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <ScreenHeader title={t("seriesHome.tab.myList")} description={t("library.subtitle")} />
      <LibraryView />
    </PageContainer>
  );
}
