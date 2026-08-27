"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { backfillWatchedEpisodeIds, type BackfillEpisodeIdsResult } from "@/lib/queries/backfillEpisodeIds";
import { SectionPageHeader } from "@/components/profile/SectionPageHeader";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * "Motor resistente" — Etapa 4 (backfill), 2026-08-26. Mesmo padrão de
 * tela de `repair-series/page.tsx` (auto-atendimento, sem depender de
 * ninguém mexer no banco por fora) — ver `backfillEpisodeIds.ts` pra
 * detalhe completo da lógica e da checagem de segurança.
 */
export default function BackfillEpisodeIdsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<BackfillEpisodeIdsResult | null>(null);

  async function handleRun() {
    setStatus("running");
    const outcome = await backfillWatchedEpisodeIds((done, total) => setProgress({ done, total }));
    setResult(outcome);
    setStatus("done");
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-24 pt-4">
      <SectionPageHeader title={t("settings.backfillEpisodeIds")} backHref="/profile/settings" />

      <p className="mb-6 text-sm text-muted">{t("settings.backfillEpisodeIds.description")}</p>

      {status === "idle" && (
        <button
          type="button"
          onClick={handleRun}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-background"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
          {t("settings.backfillEpisodeIds.fixNow")}
        </button>
      )}

      {status === "running" && (
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-sm text-text">{t("settings.backfillEpisodeIds.fixing", { done: progress.done, total: progress.total })}</p>
          <p className="mt-1 text-xs text-muted">{t("settings.backfillEpisodeIds.mayTakeAMinute")}</p>
        </div>
      )}

      {status === "done" && result && (
        <div className="rounded-lg border border-border bg-surface p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" strokeWidth={1.5} />
          {/*
           * CORREÇÃO (bug real, reportado com print — a tela mostrava
           * "0 episódios atualizados em 0 séries" mesmo quando TODAS as
           * séries falharam por erro (ex.: TMDB fora do ar por um
           * instante), disfarçando uma falha real de "nada a fazer".
           * Agora distingue 3 casos: nada encontrado pra preencher
           * (`totalSeriesScanned === 0`), sucesso normal (mesmo que
           * parcial), e falha visível quando alguma série não pôde ser
           * verificada.
           */}
          {result.totalSeriesScanned === 0 ? (
            <p className="text-sm text-text">{t("settings.backfillEpisodeIds.resultNone")}</p>
          ) : (
            <p className="text-sm text-text">
              {t("settings.backfillEpisodeIds.result", { episodes: result.episodesUpdated, series: result.seriesUpdated })}
            </p>
          )}
          {result.seriesSkippedRestructured > 0 && (
            <p className="mt-2 text-xs text-muted">
              {t("settings.backfillEpisodeIds.resultSkipped", { count: result.seriesSkippedRestructured })}
              {result.seriesSkippedRestructuredIds.length > 0 && ` (${result.seriesSkippedRestructuredIds.join(", ")})`}
            </p>
          )}
          {result.seriesSkippedError > 0 && (
            <p className="mt-2 text-xs text-danger">
              {t("settings.backfillEpisodeIds.resultError", { count: result.seriesSkippedError })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
