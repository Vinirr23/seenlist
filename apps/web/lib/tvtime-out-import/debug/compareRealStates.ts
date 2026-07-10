import { createClient } from "@/lib/supabase/client";
import { fetchLibraryItems } from "@/lib/queries/library-state";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";

export interface RealStateComparisonRow {
  title: string;
  tvdb_id: string;
  tmdb_id: number | null;
  csv_status: string;
  database_status: string | null;
  library_status: string | null;
  equal_csv_database: boolean;
  equal_database_library: boolean;
}

/**
 * TASK-034 — comparação de três estados REAIS, sem simulação
 * nenhuma. "Biblioteca" aqui é literalmente o resultado de
 * `fetchLibraryItems()` — a MESMA função que `useLibraryItems()`
 * chama na tela de verdade (3 consultas reais + resumos em lote
 * reais) — não uma reconstrução artificial com dado inventado, como
 * a antiga `computeLibraryDisplay` do migration-verdict.json fazia.
 *
 * Matching é feito de novo aqui (só leitura, mesma rota do
 * importador) porque `series_status` guarda `series_id` (tmdb_id),
 * não `tvdb_id` — é o único jeito de saber qual linha do CSV
 * corresponde a qual linha do banco.
 *
 * Uso (console, na tela do importador, com seriesRows em memória):
 *   const report = await compareRealStates(seriesRows);
 *   downloadComparisonReport(report);
 */
export async function compareRealStates(seriesRows: ParsedSeriesFileRow[]): Promise<RealStateComparisonRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[compare-real-states] Sem sessão.");
    return [];
  }

  console.log(`[compare-real-states] Rodando matching (só leitura) pra ${seriesRows.length} séries...`);
  const tmdbIdByTvdbId = new Map<string, number | null>();
  const BATCH_SIZE = 10;
  for (let start = 0; start < seriesRows.length; start += BATCH_SIZE) {
    const batch = seriesRows.slice(start, start + BATCH_SIZE);
    try {
      const response = await fetch("/api/tvtime-out-import/find-by-external-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch.map((r) => ({ id: r.tvdbId, source: "tvdb_id" })) }),
      });
      if (response.ok) {
        const data = (await response.json()) as { results: { tvdbId: string; seriesTmdbId: number | null }[] };
        for (const result of data.results) {
          tmdbIdByTvdbId.set(result.tvdbId, result.seriesTmdbId);
        }
      }
    } catch (error) {
      console.error(`[compare-real-states] Falha no lote de matching ${start}-${start + BATCH_SIZE}`, error);
    }
    console.log(
      `[compare-real-states] Matching: ${Math.min(start + BATCH_SIZE, seriesRows.length)}/${seriesRows.length}`
    );
  }

  console.log("[compare-real-states] Lendo series_status real (tabela inteira do usuário)...");
  const { data: dbRows, error: dbError } = await supabase
    .from("series_status")
    .select("series_id, status")
    .eq("user_id", user.id);
  if (dbError) {
    console.error("[compare-real-states] Falha ao ler series_status", dbError);
    return [];
  }
  const dbStatusByTmdbId = new Map((dbRows ?? []).map((r) => [r.series_id as number, r.status as string]));

  console.log("[compare-real-states] Chamando fetchLibraryItems() — a MESMA função real que a tela usa...");
  const libraryItems = await fetchLibraryItems();
  const libraryStatusByTmdbId = new Map(
    libraryItems.filter((i) => i.mediaType === "series").map((i) => [i.id, i.status as string])
  );

  const report: RealStateComparisonRow[] = seriesRows.map((row) => {
    const tmdbId = (row.tvdbId ? tmdbIdByTvdbId.get(row.tvdbId) : undefined) ?? null;
    const databaseStatus = tmdbId !== null ? dbStatusByTmdbId.get(tmdbId) ?? null : null;
    const libraryStatus = tmdbId !== null ? libraryStatusByTmdbId.get(tmdbId) ?? null : null;

    return {
      title: row.title,
      tvdb_id: row.tvdbId ?? "",
      tmdb_id: tmdbId,
      csv_status: row.status,
      database_status: databaseStatus,
      library_status: libraryStatus,
      equal_csv_database: databaseStatus !== null && statusesConceptuallyMatch(row.status, databaseStatus),
      equal_database_library: databaseStatus !== null && libraryStatus !== null && databaseStatus === libraryStatus,
    };
  });

  printGroupedReport(report);
  return report;
}

function statusesConceptuallyMatch(csvStatus: string, dbStatus: string): boolean {
  const expected: Record<string, string[]> = {
    not_started_yet: ["want_to_watch"],
    watch_later: ["want_to_watch"],
    stopped: ["paused"],
    continuing: ["watching", "completed"],
    up_to_date: ["up_to_date", "watching", "completed"],
  };
  return (expected[csvStatus] ?? []).includes(dbStatus);
}

function printGroupedReport(report: RealStateComparisonRow[]) {
  const csvVsDb = report.filter((r) => !r.equal_csv_database);
  const dbVsLibrary = report.filter((r) => r.database_status !== null && !r.equal_database_library);

  console.log("=========================================");
  console.log("RESUMO — comparação de 3 estados reais");
  console.log("=========================================");
  console.log(`Total de séries: ${report.length}`);
  console.log(`CSV != Banco: ${csvVsDb.length}`);
  console.log(`Banco != Biblioteca: ${dbVsLibrary.length}`);
  console.log("");

  if (csvVsDb.length > 0) {
    console.group("%cCSV != Banco (bug está na IMPORTAÇÃO)", "font-weight: bold; color: #E8574A");
    const groups = new Map<string, RealStateComparisonRow[]>();
    for (const r of csvVsDb) {
      const key = `${r.csv_status} → ${r.database_status}`;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }
    for (const [key, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`${key}: ${list.length} séries — ex.: ${list.slice(0, 5).map((r) => r.title).join(", ")}`);
    }
    console.groupEnd();
  }

  if (dbVsLibrary.length > 0) {
    console.group("%cBanco != Biblioteca (bug está na BIBLIOTECA)", "font-weight: bold; color: #E8574A");
    const groups = new Map<string, RealStateComparisonRow[]>();
    for (const r of dbVsLibrary) {
      const key = `${r.database_status} → ${r.library_status}`;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }
    for (const [key, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`${key}: ${list.length} séries — ex.: ${list.slice(0, 5).map((r) => r.title).join(", ")}`);
    }
    console.groupEnd();
  }

  if (csvVsDb.length === 0 && dbVsLibrary.length === 0) {
    console.log("✅ Nenhuma divergência nos três estados reais.");
  }
}

export function downloadComparisonReport(report: RealStateComparisonRow[]): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `real-state-comparison-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
