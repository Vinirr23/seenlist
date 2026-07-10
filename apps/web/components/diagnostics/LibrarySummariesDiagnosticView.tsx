"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  runLibrarySummariesDiagnostic,
  downloadLibrarySummariesDiagnostic,
  type LibrarySummariesDiagnosticReport,
} from "@/lib/diagnostics/librarySummariesDiagnostic";

/**
 * TASK-037 — "Diagnóstico do carregamento de capas". Só instrumenta
 * e relata — não altera nenhuma lógica de produção, não implementa
 * throttling, não reduz concorrência, não muda tamanho de lote.
 */
export function LibrarySummariesDiagnosticView() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<LibrarySummariesDiagnosticReport | null>(null);

  async function handleRun() {
    setRunning(true);
    setReport(null);
    try {
      const result = await runLibrarySummariesDiagnostic();
      setReport(result);
      downloadLibrarySummariesDiagnostic(result);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-xl font-bold text-text">Diagnóstico do carregamento de capas</h1>
      <p className="mb-6 text-sm text-muted">
        Reproduz exatamente a mesma chamada que a Biblioteca faz — incluindo o corte de 100 já existente na rota de
        produção — e instrumenta cada requisição individual ao TMDB. Não altera nenhuma lógica de produção.
      </p>

      <button
        type="button"
        onClick={handleRun}
        disabled={running}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-background disabled:opacity-60"
      >
        <Search className="h-4 w-4" strokeWidth={2} />
        {running ? "Analisando…" : "🔍 Diagnóstico do carregamento de capas"}
      </button>

      {report && (
        <div className="mt-8 space-y-4">
          <div className="rounded-lg border border-border p-4 font-mono text-xs text-text">
            <p>IDs recebidos: {report.batch.ids_received}</p>
            <p>IDs cortados pelo limite de 100: {report.batch.ids_dropped_by_slicing_count}</p>
            <p>Requisições iniciadas: {report.batch.requests_started}</p>
            <p className="mt-2">HTTP 200: {report.batch.http_200}</p>
            <p>HTTP 404: {report.batch.http_404}</p>
            <p>HTTP 429: {report.batch.http_429}</p>
            <p>HTTP 500: {report.batch.http_500}</p>
            <p>Outros HTTP: {report.batch.other_http}</p>
            <p>Timeout: {report.batch.timeouts}</p>
            <p>Exceções: {report.batch.exceptions}</p>
            <p className="mt-2">Tempo total do lote: {report.batch.batch_duration_ms}ms</p>
            <p>Tempo médio por requisição: {report.batch.average_request_duration_ms.toFixed(0)}ms</p>
            <p className="mt-2">Poster presente: {report.batch.poster_present}</p>
            <p>Poster ausente: {report.batch.poster_absent}</p>
            <p className="mt-2">Resumos inseridos na Biblioteca: {report.library_comparison.inserted_in_library}</p>
            <p>Resumos descartados após sucesso no TMDB: {report.library_comparison.discarded_after_tmdb_success}</p>
          </div>

          {report.batch.ids_dropped_by_slicing_count > 0 && (
            <div className="rounded-lg border border-danger p-4">
              <p className="text-sm font-semibold text-danger">
                {report.batch.ids_dropped_by_slicing_count} IDs nunca chegaram a ser requisitados ao TMDB — cortados
                pelo limite de {report.batch.ids_received - report.batch.ids_dropped_by_slicing_count} antes de
                qualquer chamada.
              </p>
            </div>
          )}

          {report.batch.promise_rejections_caught.length > 0 && (
            <div className="rounded-lg border border-danger p-4">
              <p className="mb-2 text-sm font-semibold text-danger">Exceções capturadas (não engolidas)</p>
              {report.batch.promise_rejections_caught.map((r, index) => (
                <p key={`${r.tmdb_id ?? "desconhecido"}-${index}`} className="text-xs text-muted">
                  tmdb_id {r.tmdb_id ?? "desconhecido"}: {r.reason}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => downloadLibrarySummariesDiagnostic(report)}
            className="w-full rounded-lg border border-border py-2.5 text-sm text-text"
          >
            Baixar relatório novamente
          </button>
        </div>
      )}
    </div>
  );
}
