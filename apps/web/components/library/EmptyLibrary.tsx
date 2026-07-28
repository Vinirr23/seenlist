"use client";

import { EmptyState } from "../search/EmptyState";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function EmptyLibrary({ message }: { message?: string }) {
  const { t } = useTranslation();
  return <EmptyState message={message ?? t("library.emptyDefault")} />;
}
