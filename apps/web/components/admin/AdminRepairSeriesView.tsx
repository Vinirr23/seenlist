"use client";

import { useState } from "react";

interface RepairResult {
  total: number;
  updated: number;
  skipped: number;
  errors: number[];
}

export function AdminRepairSeriesView() {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<RepairResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRun() {
    if (!userId.trim()) return;
    setStatus("running");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/admin/repair-series-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error ?? "Falha desconhecida.");
        setStatus("error");
        return;
      }
      setResult(data as RepairResult);
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-24 pt-6">
      <h1 className="mb-2 text-xl font-bold text-text">Reparar status de série (admin)</h1>
      <p className="mb-6 text-sm text-muted">
        Recalcula o status (Assistindo/Em dia/Concluída) de todas as séries de um usuário específico, comparando
        com dado atual do TMDB — útil depois de uma importação (Trakt/TV Time) que deixou séries presas.
      </p>

      <label className="mb-1 block text-xs font-medium text-muted">ID do usuário (user_id)</label>
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="72664cc8-5857-4f3b-9ea6-0f9c524a0150"
        className="mb-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

      <button
        type="button"
        onClick={handleRun}
        disabled={!userId.trim() || status === "running"}
        className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-50"
      >
        {status === "running" ? "Rodando..." : "Rodar reparo"}
      </button>

      {status === "done" && result && (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-text">
          <p>Total de séries verificadas: {result.total}</p>
          <p>Corrigidas: {result.updated}</p>
          <p>Já estavam certas / sem dado suficiente: {result.skipped}</p>
          {result.errors.length > 0 && (
            <p className="mt-2 text-danger">Falharam: {result.errors.join(", ")}</p>
          )}
        </div>
      )}

      {status === "error" && errorMessage && (
        <p className="mt-4 text-sm text-danger">{errorMessage}</p>
      )}
    </div>
  );
}
