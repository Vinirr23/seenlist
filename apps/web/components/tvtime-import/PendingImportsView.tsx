"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { loadPendingMatches, clearPendingMatches } from "@/lib/tvtime-import/pendingStorage";
import { confirmManualMapping } from "@/lib/tvtime-import/tmdb/matchShow";
import { runImport } from "@/lib/tvtime-import/import/runImport";
import type { ShowMatch } from "@/lib/tvtime-import/mapping/types";
import { ManualMatchStep } from "./ManualMatchStep";
import { useToast } from "@/lib/toast/ToastProvider";

/**
 * TASK-027.5 — tela separada pra resolver o que ficou pendente de
 * uma importação anterior, sem bloquear a importação em si (que já
 * terminou antes de esta tela sequer existir). Lê de
 * `pendingStorage` (localStorage) — ver esse arquivo pra entender a
 * limitação de não sincronizar entre dispositivos.
 */
export function PendingImportsView() {
  const [pending, setPending] = useState<ShowMatch[] | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setPending(loadPendingMatches());
  }, []);

  async function handleComplete(resolutions: Map<string, number | null>) {
    if (!pending) return;
    setSaving(true);

    const resolvedMatches: ShowMatch[] = [];
    for (const match of pending) {
      const resolution = resolutions.get(match.show.tvTimeId);
      if (resolution) {
        confirmManualMapping(match.show, resolution);
        resolvedMatches.push({ ...match, tmdbId: resolution, status: "resolved" });
      }
    }

    if (resolvedMatches.length > 0) {
      await runImport(resolvedMatches, {
        importLibrary: true,
        importEpisodes: true,
        restoreProgress: true,
        mergeStrategy: "merge",
      });
    }

    clearPendingMatches();
    setSaving(false);
    toast.success(`${resolvedMatches.length} série(s) importada(s)`);
    router.push("/series");
  }

  if (pending === null) return null;

  if (pending.length === 0) {
    return (
      <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center px-6 text-center md:mx-auto md:max-w-[430px]">
        <CheckCircle2 className="h-10 w-10 text-success" strokeWidth={1.5} />
        <p className="mt-4 text-sm text-text">Nenhuma pendência de importação no momento.</p>
        <Link href="/series" className="mt-4 text-sm text-primary underline">
          Voltar pra Minha Lista
        </Link>
      </div>
    );
  }

  if (saving) {
    return (
      <div className="flex min-h-[60dvh] w-full items-center justify-center px-6 text-center">
        <p className="text-sm text-text">Salvando…</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 px-4 pt-4">
        <Link
          href="/series"
          aria-label="Voltar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">Pendências de importação</h1>
      </div>
      <ManualMatchStep pendingMatches={pending} onComplete={handleComplete} />
    </div>
  );
}
