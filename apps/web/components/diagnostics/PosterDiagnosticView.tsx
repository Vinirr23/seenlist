"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  runPosterDiagnostic,
  downloadPosterDiagnosticReport,
  type PosterDiagnosticReport,
} from "@/lib/diagnostics/posterDiagnostic";

/**
 * TASK-036 — "Diagnóstico de Capas". Só investiga, nenhuma correção
 * automática. Página isolada, não altera nenhuma tela existente.
 */
export function PosterDiagnosticView() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [report, setReport] = useState<PosterDiagnosticReport | null>(null);

  async function handleRun() {
    setRunning(true);
    setReport(null);
    try {
      const result = await runPosterDiagnostic((current, total) => setProgress({ current, total }));
      setReport(result);
      downloadPosterDiagnosticReport(result);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-xl font-bold text-text">Diagnóstico de Capas</h1>
      <p className="mb-6 text-sm text-muted">
        Analisa a biblioteca real (a mesma função que a tela usa) e compara com uma busca fresca ao TMDB, série por
        série sem capa. Não corrige nada — só descobre a causa.
      </p>

      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-background disabled:opacity-60"
      >
        <Search className="h-4 w-4" strokeWidth={2} />
        {running ? `Analisando… ${progress ? `${progress.current}/${progress.total}` : ""}` : "Rodar diagnóstico"}
      </button>

      {report && (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-border p-4">
            <p className="mb-1 text-xs text-muted">{report.architectural_note}</p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-text">Total de séries: {report.summary.total_series}</p>
            <p className="text-sm text-text">Com capa: {report.summary.with_cover}</p>
            <p className="text-sm text-text">Sem capa: {report.summary.without_cover}</p>
          </div>

          {Object.entries(report.summary.causes).length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 text-sm font-semibold text-text">Causas agrupadas</p>
              {Object.entries(report.summary.causes)
                .sort((a, b) => b[1] - a[1])
                .map(([cause, count]) => (
                  <p key={cause} className="mb-2 text-xs text-muted">
                    <span className="font-medium text-text">{count} série(s)</span> — {cause}
                  </p>
                ))}
            </div>
          )}

          {report.rows.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 text-sm font-semibold text-text">Séries sem capa</p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {report.rows.map((row) => (
                  <p key={row.tmdb_id} className="text-xs text-muted">
                    <span className="text-text">{row.title}</span> (tmdb_id {row.tmdb_id}, status {row.status})
                  </p>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => downloadPosterDiagnosticReport(report)}
            className="w-full rounded-lg border border-border py-2.5 text-sm text-text"
          >
            Baixar relatório novamente
          </button>
        </div>
      )}
    </div>
  );
}
