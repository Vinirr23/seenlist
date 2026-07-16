"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Check, AlertTriangle } from "lucide-react";
import { extractTvTimeOutArchive } from "@/lib/tvtime-out-import/parser/zip";
import { parseSeriesFile, type ParsedSeriesFileRow } from "@/lib/tvtime-out-import/parser/seriesParser";
import { parseEpisodesFile, groupEpisodesBySeriesUuid } from "@/lib/tvtime-out-import/parser/episodesParser";
import { parseMoviesFile, type ParsedMovieFileRow } from "@/lib/tvtime-out-import/parser/moviesParser";
import type { ParsedEpisodeRow } from "@/lib/tvtime-out-import/parser/episodesParser";
import { runMigration } from "@/lib/tvtime-migration/runMigration";
import { downloadMigrationReport, type MigrationReport, type MigrationReportRow } from "@/lib/tvtime-migration/report";
import { createClient } from "@/lib/supabase/client";
import { LIBRARY_QUERY_KEY } from "@/lib/queries/library-state";

type Step =
  | "upload"
  | "confirm-wipe"
  | "processing"
  | "confirm-matches"
  | "confirm-specials"
  | "done"
  | "error"
  | "restored-after-failure";

interface ParsedFileData {
  seriesRows: ParsedSeriesFileRow[];
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>;
  movieRows: ParsedMovieFileRow[];
}

/** Confirmado: nada neste componente invalidava cache nenhum depois do wipe/importação — a tela podia continuar mostrando dado de antes do apagar até um reload manual, parecendo "mesclou" quando o banco já estava correto. Invalida tudo que pode ter ficado desatualizado, de uma vez. */
function invalidateAllLibraryCaches(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["series-status"] });
  queryClient.invalidateQueries({ queryKey: ["watched-episodes"] });
  queryClient.invalidateQueries({ queryKey: ["movie-status"] });
}

/** Supabase (PostgrestError) nunca serializa bem em console.error/JSON.stringify — sem isso, o log mostra só "{}", como já aconteceu. Extrai os campos reais (message/details/hint/code) pra sempre dar pra ver o motivo de verdade. */
function describeSupabaseError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint, e.code ? `(código ${e.code})` : null].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}


/**
 * TASK-040 — "substituir biblioteca": o arquivo é lido e validado
 * ANTES de qualquer coisa tocar o banco (se o zip for inválido, nada
 * foi apagado ainda). Só depois de confirmado explicitamente é que
 * `wipe_user_library()` roda — ela devolve uma foto completa da
 * biblioteca atual, guardada em memória. Se a importação falhar de
 * forma catastrófica (nenhuma série/filme sequer entrou), a foto é
 * usada pra restaurar tudo via `restore_user_library()`, alcançando
 * na prática "se falhar, nada foi apagado" mesmo sem uma transação
 * única cobrindo as chamadas de rede ao TMDB (que não podem rodar
 * dentro de uma transação de banco).
 */
export function MigrateFromTvTimeButton() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; current: number; total: number } | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setStep("processing");
    try {
      const { files } = await extractTvTimeOutArchive(file);
      if (!files.series || !files.episodes) {
        setError("Não encontrei tvtime-series-*.csv e tvtime-series-episodes-*.csv dentro do zip.");
        setStep("error");
        return;
      }
      const seriesRows = parseSeriesFile(files.series);
      const episodeRows = parseEpisodesFile(files.episodes);
      const episodesBySeriesUuid = groupEpisodesBySeriesUuid(episodeRows);
      const movieRows = files.movies ? parseMoviesFile(files.movies) : [];

      // Nada do banco foi tocado até aqui — só parseado o arquivo. Agora sim, pede confirmação antes de apagar qualquer coisa.
      setParsedData({ seriesRows, episodesBySeriesUuid, movieRows });
      setStep("confirm-wipe");
    } catch (err) {
      console.error("[tvtime-migration] Falha ao ler o arquivo", err);
      setError("Não foi possível processar o arquivo. Confira se é o zip exportado pela extensão TV Time Out.");
      setStep("error");
    }
  }, []);

  const runWipeThenImport = useCallback(async () => {
    if (!parsedData) return;
    setStep("processing");
    setProgress({ label: "Apagando biblioteca atual…", current: 0, total: 1 });

    const supabase = createClient();
    let snapshot: unknown = null;
    try {
      const { data, error: wipeError } = await supabase.rpc("wipe_user_library");
      if (wipeError) throw wipeError;
      snapshot = data;
      invalidateAllLibraryCaches(queryClient);
    } catch (err) {
      const reason = describeSupabaseError(err);
      console.error(`[tvtime-migration] Falha ao apagar a biblioteca — nada foi importado, biblioteca antiga preservada. Motivo: ${reason}`, err);
      setError(`Não foi possível apagar a biblioteca atual (${reason}). Nada foi importado — sua biblioteca antiga continua intacta.`);
      setStep("error");
      return;
    }

    try {
      const result = await runMigration(
        parsedData.seriesRows,
        parsedData.episodesBySeriesUuid,
        parsedData.movieRows,
        (label, current, total) => setProgress({ label, current, total })
      );

      const nothingImported = result.imported === 0 && result.movies_imported === 0;
      if (nothingImported) {
        // Falha catastrófica — restaura a biblioteca antiga a partir da foto.
        await supabase.rpc("restore_user_library", { snapshot });
        invalidateAllLibraryCaches(queryClient);
        setError(
          "A importação não conseguiu trazer nenhuma série ou filme. Sua biblioteca antiga foi restaurada — nada foi perdido."
        );
        setStep("restored-after-failure");
        return;
      }

      downloadMigrationReport(result);
      setReport(result);
      invalidateAllLibraryCaches(queryClient);
      const totalPending = result.pending_confirmation + result.movies_pending_confirmation;
      setStep(totalPending > 0 ? "confirm-matches" : "done");
    } catch (err) {
      const reason = describeSupabaseError(err);
      console.error(`[tvtime-migration] Importação falhou de forma catastrófica — restaurando biblioteca antiga. Motivo: ${reason}`, err);
      try {
        await supabase.rpc("restore_user_library", { snapshot });
        invalidateAllLibraryCaches(queryClient);
        setError(`A importação falhou (${reason}). Sua biblioteca antiga foi restaurada — nada foi perdido.`);
        setStep("restored-after-failure");
      } catch (restoreErr) {
        const restoreReason = describeSupabaseError(restoreErr);
        console.error(`[tvtime-migration] Falha ao restaurar a biblioteca depois de uma importação malsucedida. Motivo: ${restoreReason}`, restoreErr);
        setError(
          `A importação falhou (${reason}) E não foi possível restaurar automaticamente a biblioteca antiga (${restoreReason}). Entre em contato com o suporte antes de tentar de novo.`
        );
        setStep("error");
      }
    }
  }, [parsedData, queryClient]);

  const pendingSpecials =
    report?.rows.filter((r) => (r.episodes_reconstructed?.specials_pending_confirmation ?? 0) > 0) ?? [];

  if (step === "upload") {
    return (
      <div className="mx-auto max-w-sm px-6 py-10 text-center">
        <h1 className="mb-2 text-xl font-bold text-text">Migrar do TV Time</h1>
        <p className="mb-6 text-sm text-muted">
          Envie o arquivo exportado pela extensão TV Time Out. O status do arquivo é a única fonte de verdade —
          nenhuma categoria é inventada.
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
        <a
          href="https://www.youtube.com/shorts/pZll79vgfMU"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white"
        >
          Assistir tutorial em vídeo
        </a>
      </div>
    );
  }

  if (step === "confirm-wipe") {
    return (
      <div className="mx-auto max-w-sm px-6 py-10 text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-danger" strokeWidth={1.5} />
        <p className="mb-6 text-base font-medium text-text">
          Esta importação substituirá toda a sua biblioteca atual. Deseja continuar?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setParsedData(null);
              setStep("upload");
            }}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void runWipeThenImport()}
            className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-background"
          >
            Substituir e continuar
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
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

  if (step === "restored-after-failure") {
    return (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-danger" strokeWidth={1.5} />
        <p className="mb-4 text-sm text-text">{error}</p>
        <button
          type="button"
          onClick={() => {
            setParsedData(null);
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

  if (step === "error") {
    return (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <p className="mb-4 text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={() => setStep("upload")}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (step === "confirm-matches" && report) {
    const pendingSeries = report.rows
      .filter((r) => r.needs_confirmation)
      .map((r) => ({ uuid: r.uuid, title: r.title, matching: r.matching, mediaType: "series" as const }));
    const pendingMovies = report.movie_rows
      .filter((r) => r.needs_confirmation)
      .map((r) => ({ uuid: r.uuid, title: r.title, matching: r.matching, mediaType: "movie" as const }));
    return (
      <MatchConfirmationScreen
        pending={[...pendingSeries, ...pendingMovies]}
        onDone={() => setStep(pendingSpecials.length > 0 ? "confirm-specials" : "done")}
      />
    );
  }

  if (step === "confirm-specials" && report) {
    return <SpecialsConfirmationScreen rows={pendingSpecials} onDone={() => setStep("done")} />;
  }

  if (step === "done" && report) {
    return (
      <div className="mx-auto max-w-sm px-6 py-16 text-center">
        <Check className="mx-auto mb-4 h-12 w-12 text-primary" strokeWidth={1.5} />
        <p className="text-lg font-bold text-text">Migração concluída</p>
        <p className="mt-2 text-sm text-muted">
          {report.imported} séries importadas de {report.total_series_in_file} no arquivo.
          {report.discarded.length > 0 && ` ${report.discarded.length} descartadas.`}
          <br />
          {report.movies_imported} filmes importados de {report.total_movies_in_file} no arquivo.
          {report.movies_discarded.length > 0 && ` ${report.movies_discarded.length} descartados.`}
          <br />
          Ver detalhes completos em migration-report.json.
        </p>
        <button
          type="button"
          onClick={() => downloadMigrationReport(report)}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm text-text"
        >
          Baixar relatório novamente
        </button>
      </div>
    );
  }

  return null;
}

interface PendingItem {
  uuid: string;
  title: string;
  matching: MigrationReportRow["matching"];
  mediaType: "series" | "movie";
}

function MatchConfirmationScreen({ pending, onDone }: { pending: PendingItem[]; onDone: () => void }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function confirmChoice(item: PendingItem, tmdbId: number) {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (item.mediaType === "series") {
          await supabase.from("series_status").upsert(
            { user_id: user.id, series_id: tmdbId, status: "watching", updated_at: new Date().toISOString() },
            { onConflict: "user_id,series_id" }
          );
        } else {
          await supabase.from("movie_status").upsert(
            { user_id: user.id, movie_id: tmdbId, status: "want_to_watch", updated_at: new Date().toISOString() },
            { onConflict: "user_id,movie_id" }
          );
        }
      }
    } finally {
      setSaving(false);
      setResolved((prev) => new Set(prev).add(item.uuid));
    }
  }

  const remaining = pending.filter((r) => !resolved.has(r.uuid));

  return (
    <div className="mx-auto max-w-sm px-6 py-8">
      <h1 className="mb-2 text-lg font-bold text-text">Confirmar itens ambíguos</h1>
      <p className="mb-6 text-sm text-muted">
        {remaining.length} série(s)/filme(s) tiveram mais de um candidato possível, ou nenhum encontrado. Escolha
        manualmente — nada foi salvo automaticamente pra esses.
      </p>
      <div className="space-y-4">
        {remaining.map((item) => (
          <div key={item.uuid} className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium text-text">
              {item.title} <span className="text-xs text-muted">({item.mediaType === "series" ? "série" : "filme"})</span>
            </p>
            {item.matching.candidates.length === 0 ? (
              <p className="text-xs text-muted">Nenhum candidato encontrado no TMDB — pulado.</p>
            ) : (
              <div className="space-y-2">
                {item.matching.candidates.map((c) => (
                  <button
                    key={c.tmdbId}
                    type="button"
                    disabled={saving}
                    onClick={() => confirmChoice(item, c.tmdbId)}
                    className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm text-text hover:border-primary disabled:opacity-50"
                  >
                    <span>
                      {c.title} {c.year ? `(${c.year})` : ""}
                    </span>
                    {c.totalEpisodes !== null && <span className="text-xs text-muted">{c.totalEpisodes} eps.</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onDone}
        disabled={remaining.length > 0}
        className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        {remaining.length > 0 ? `Faltam ${remaining.length}` : "Continuar"}
      </button>
    </div>
  );
}

/**
 * "Ao final da importação, perguntar ao usuário se deseja marcar
 * aqueles episódios especiais como assistidos" — nunca decidido
 * sozinho. Usa `specials_pending_list` (temporada/episódio exatos,
 * já vindo no relatório) pra gravar de verdade, não só registrar a
 * intenção no console.
 */
function SpecialsConfirmationScreen({ rows, onDone }: { rows: MigrationReportRow[]; onDone: () => void }) {
  const [saving, setSaving] = useState(false);

  async function markAllSpecialsAsWatched() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      for (const row of rows) {
        const tmdbId = row.matching.tmdbId;
        const pendingList = row.episodes_reconstructed?.specials_pending_list ?? [];
        if (!tmdbId || pendingList.length === 0) continue;

        const chunk = pendingList.map((e) => ({
          user_id: user.id,
          series_id: tmdbId,
          season_number: e.seasonNumber,
          episode_number: e.episodeNumber,
          watched_at: new Date().toISOString(),
          is_special: true,
          rewatch_count: 0,
        }));
        const { error } = await supabase
          .from("watched_episodes")
          .upsert(chunk, { onConflict: "user_id,series_id,season_number,episode_number" });
        if (error) {
          console.error(`[tvtime-migration] Falha ao marcar especiais de "${row.title}"`, error);
        }
      }
    }
    setSaving(false);
    onDone();
  }

  const totalSpecials = rows.reduce(
    (sum, r) => sum + (r.episodes_reconstructed?.specials_pending_confirmation ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-sm px-6 py-8 text-center">
      <h1 className="mb-2 text-lg font-bold text-text">Episódios especiais</h1>
      <p className="mb-6 text-sm text-muted">
        {rows.length} série(s) têm {totalSpecials} episódio(s) especial(is) que o arquivo não marcou como assistidos.
        Deseja marcá-los como assistidos também?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-text"
        >
          Não, deixar como está
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={markAllSpecialsAsWatched}
          className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          Marcar todos
        </button>
      </div>
    </div>
  );
}
