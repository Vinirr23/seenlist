"use client";

import { useEffect, useState } from "react";
import { countPendingMatches } from "@/lib/tvtime-import/pendingStorage";
import { SettingsRow } from "./SettingsRow";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** Só renderiza algo quando existe pendência de verdade — nunca uma linha vazia/decorativa. */
export function PendingTvTimeImportsRow() {
  const [count, setCount] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    setCount(countPendingMatches());
  }, []);

  if (count === 0) return null;

  return (
    <SettingsRow
      label={t("settings.tvTimePendingImports")}
      value={count === 1 ? t("settings.seriesSingular", { count }) : t("settings.seriesPlural", { count })}
      href="/import/tvtime/pending"
    />
  );
}
