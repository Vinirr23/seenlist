"use client";

import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function InlineError({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <p role="alert" className="text-[11px] text-danger">
      {t("common.error")}
    </p>
  );
}
