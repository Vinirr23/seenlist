"use client";

import { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { extractTvTimeOutArchive } from "@/lib/tvtime-out-import/parser/zip";
import { parseSeriesFile } from "@/lib/tvtime-out-import/parser/seriesParser";
import { parseEpisodesFile, groupEpisodesBySeriesUuid } from "@/lib/tvtime-out-import/parser/episodesParser";
import { parseMoviesFile } from "@/lib/tvtime-out-import/parser/moviesParser";
import { matchAllSeries, type SeriesMatchResult } from "@/lib/tvtime-out-import/matching/matchSeries";
import { matchAllMovies, type MovieMatchResult } from "@/lib/tvtime-out-import/matching/matchMovies";
import { runTvTimeOutImport, type TvTimeOutImportResult } from "@/lib/tvtime-out-import/import/runImport";
import type { ParsedSeriesFileRow } from "@/lib/tvtime-out-import/parser/seriesParser";
import type { ParsedEpisodeRow } from "@/lib/tvtime-out-import/parser/episodesParser";
import type { ParsedMovieFileRow } from "@/lib/tvtime-out-import/parser/moviesParser";
import { CelebrationScreen } from "../tvtime-import/CelebrationScreen";

type Step = "upload" | "matching" | "importing" | "done" | "error";

/**
 * TASK-027L — importador oficial, baseado no export da extensão "TV
 * Time Out". Fluxo mais direto que o antigo (GDPR): não existe etapa
 * de "reconstrução" pra mostrar, porque não existe reconstrução —
 * os episódios já vêm prontos do arquivo.
 *
 * Escopo desta primeira versão: séries/filmes não encontrados no
 * TMDB (tmdbId null) ficam listados no resultado final, mas ainda
 * não têm uma tela de resolução manual dedicada como
 * ManualMatchStep.tsx do importador antigo — dado que 100% das
 * séries do export de teste tinham tvdb_id (matching direto, sem
 * ambiguidade), esse caso deve ser raro aqui. Se na prática aparecer
 * com frequência, vale construir essa tela depois.
 */
export function TvTimeOutImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; current: number; total: number } | null>(null);
  const [result, setResult] = useState<TvTimeOutImportResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setStep("matching");

    try {
      const { files, allFileNames, matchedFileNames, exportDate } = await extractTvTimeOutArchive(file);

      if (!files.series || !files.episodes) {
        setError(
          `Não encontrei os arquivos esperados no ZIP (tvtime-series-*.csv e tvtime-series-episodes-*.csv). Arquivos encontrados: ${allFileNames.join(", ") || "nenhum"}.`
        );
        setStep("error");
        return;
      }

      const seriesRows: ParsedSeriesFileRow[] = parseSeriesFile(files.series);
      const episodeRows: ParsedEpisodeRow[] = parseEpisodesFile(files.episodes);
      const episodesBySeriesUuid = groupEpisodesBySeriesUuid(episodeRows);
      const movieRows: ParsedMovieFileRow[] = files.movies ? parseMoviesFile(files.movies) : [];

      // TASK-027R — expõe os dados já parseados no window, pra dar
      // pra rodar as ferramentas de depuração (proveStatusDivergenceReadOnly,
      // debugSingleSeries) direto do console do navegador, sem
      // precisar reimportar nem re-parsear nada. Só leitura de dados
      // já em memória — não afeta a importação em si.
      if (typeof window !== "undefined") {
        const debugWindow = window as unknown as Record<string, unknown>;
        debugWindow.seriesRows = seriesRows;
        debugWindow.episodesBySeriesUuid = episodesBySeriesUuid;
        debugWindow.exportDate = exportDate;
        import("@/lib/tvtime-out-import/debug/proveStatusDivergenceReadOnly").then((mod) => {
          debugWindow.proveStatusDivergenceReadOnly = mod.proveStatusDivergenceReadOnly;
        });
        import("@/lib/tvtime-out-import/debug/debugSingleSeries").then((mod) => {
          debugWindow.debugSingleSeries = mod.debugSingleSeries;
        });
        import("@/lib/tvtime-out-import/debug/compareRealStates").then((mod) => {
          debugWindow.compareRealStates = mod.compareRealStates;
          debugWindow.downloadComparisonReport = mod.downloadComparisonReport;
        });
        import("@/lib/tvtime-out-import/debug/auditComparisonIdentity").then((mod) => {
          debugWindow.auditComparisonIdentity = mod.auditComparisonIdentity;
        });
        console.log(
          "[tvtime-out-import] Dados disponíveis no console: seriesRows, episodesBySeriesUuid, exportDate, proveStatusDivergenceReadOnly(...), debugSingleSeries(...), compareRealStates(...), auditComparisonIdentity(...)."
        );
      }

      setProgress({ label: "Identificando séries no TMDB…", current: 0, total: seriesRows.length });
      const seriesMatches: SeriesMatchResult[] = await matchAllSeries(seriesRows, (done, total) =>
        setProgress({ label: "Identificando séries no TMDB…", current: done, total })
      );

      let movieMatches: MovieMatchResult[] = [];
      if (movieRows.length > 0) {
        setProgress({ label: "Identificando filmes no TMDB…", current: 0, total: movieRows.length });
        movieMatches = await matchAllMovies(movieRows, (done, total) =>
          setProgress({ label: "Identificando filmes no TMDB…", current: done, total })
        );
      }

      setStep("importing");
      setProgress({ label: "Importando…", current: 0, total: seriesMatches.length + movieMatches.length });

      const importResult = await runTvTimeOutImport(
        seriesRows,
        episodesBySeriesUuid,
        seriesMatches,
        movieRows,
        movieMatches,
        { importSeries: true, importMovies: movieRows.length > 0 },
        (current) => setProgress({ label: current.name, current: current.index, total: current.total }),
        matchedFileNames.series ?? file.name,
        exportDate
      );

      console.log("[tvtime-out-import] Importação concluída", importResult);
      setResult(importResult);
      setStep("done");
    } catch (err) {
      console.error("[tvtime-out-import] Falha na importação", err);
      setError("Não foi possível processar o arquivo. Confira se é o ZIP exportado pela extensão TV Time Out.");
      setStep("error");
    }
  }, []);

  if (step === "upload") {
    return (
      <div className="mx-auto max-w-sm px-6 py-10 text-center">
        <h1 className="mb-2 text-xl font-bold text-text">Importar do TV Time</h1>
        <p className="mb-6 text-sm text-muted">
          Envie o arquivo exportado pela extensão{" "}
          <a
            href="https://chromewebstore.google.com/"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            TV Time Out
          </a>
          .
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-muted transition-colors hover:border-primary hover:text-text">
          <Upload className="h-8 w-8" strokeWidth={1.5} />
          <span className="text-sm">Toque para selecionar o .zip</span>
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>
    );
  }

  if (step === "matching" || step === "importing") {
    const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-sm text-muted">{progress?.label ?? "Processando…"}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        {progress && (
          <p className="text-xs text-muted">
            {progress.current} de {progress.total}
          </p>
        )}
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <p className="mb-4 text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("upload");
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <div>
        <CelebrationScreen
          showCount={result.seriesImported}
          episodeCount={result.episodesImported}
          favoriteCount={0}
          pendingCount={result.seriesNotFound + result.moviesNotFound}
        />
        {(result.seriesNotFound > 0 || result.moviesNotFound > 0) && (
          <div className="mx-auto max-w-sm px-6 pb-8 text-center text-xs text-muted">
            {result.seriesNotFound + result.moviesNotFound} item(ns) não encontrados no TMDB — verifique o console
            para os títulos exatos.
          </div>
        )}
      </div>
    );
  }

  return null;
}
