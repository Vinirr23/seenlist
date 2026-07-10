"use client";

import { useEffect, useState } from "react";
import { countPendingMatches } from "@/lib/tvtime-import/pendingStorage";
import { SettingsRow } from "./SettingsRow";

/** Só renderiza algo quando existe pendência de verdade — nunca uma linha vazia/decorativa. */
export function PendingTvTimeImportsRow() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(countPendingMatches());
  }, []);

  if (count === 0) return null;

  return (
    <SettingsRow
      label="Pendências da importação do TV Time"
      value={`${count} ${count === 1 ? "série" : "séries"}`}
      href="/import/tvtime/pending"
    />
  );
}
