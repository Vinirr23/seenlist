"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { repairAllSeriesCategories } from "@/lib/queries/repairSeriesCategories";
import { SectionPageHeader } from "@/components/profile/SectionPageHeader";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-175 — a pedido, depois de um feedback de usuário mostrar que
 * séries importadas (Trakt, mas pode acontecer por outros caminhos
 * também) ficavam presas em "Assistindo" mesmo já totalmente vistas,
 * até visitar uma por uma. Ferramenta de auto-atendimento — não
 * depende de ninguém mexer no banco pra cada pessoa.
 */
export default function RepairSeriesPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [totalFixed, setTotalFixed] = useState(0);

  async function handleRun() {
    setStatus("running");
    const total = await repairAllSeriesCategories((done, total) => setProgress({ done, total }));
    setTotalFixed(total);
    setStatus("done");
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-24 pt-4">
      <SectionPageHeader title={t("settings.repairSeriesStatus")} backHref="/profile/settings" />

      <p className="mb-6 text-sm text-muted">{t("settings.repairSeries.description")}</p>

      {status === "idle" && (
        <button
          type="button"
          onClick={handleRun}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-background"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
          {t("settings.repairSeries.fixNow")}
        </button>
      )}

      {status === "running" && (
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-sm text-text">{t("settings.repairSeries.fixing", { done: progress.done, total: progress.total })}</p>
          <p className="mt-1 text-xs text-muted">{t("settings.repairSeries.mayTakeAMinute")}</p>
        </div>
      )}

      {status === "done" && (
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" strokeWidth={1.5} />
          <p className="text-sm text-text">{t("settings.repairSeries.result", { count: totalFixed })}</p>
        </div>
      )}
    </div>
  );
}
