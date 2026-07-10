"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { extractArchive } from "@/lib/tvtime-import/parser/zip";
import { validateArchive } from "@/lib/tvtime-import/validators/validateArchive";
import { buildParsedArchive } from "@/lib/tvtime-import/mapping/buildParsedArchive";
import { matchAllShows } from "@/lib/tvtime-import/tmdb/matchShow";
import { runImport } from "@/lib/tvtime-import/import/runImport";
import { logImportTelemetry } from "@/lib/tvtime-import/telemetry";
import { savePendingMatches } from "@/lib/tvtime-import/pendingStorage";
import { ImportDiagnostics } from "@/lib/tvtime-import/diagnostics";
import { buildAuditReport } from "@/lib/tvtime-import/audit/buildAuditReport";
import { printAuditMode, AUDIT_MODE_ENABLED } from "@/lib/tvtime-import/audit/printAuditMode";
import { printFinalReport } from "@/lib/tvtime-import/audit/printFinalReport";
import { downloadAuditJson, downloadAuditMarkdown } from "@/lib/tvtime-import/audit/exportAudit";
import { downloadPipelineDiagnostic } from "@/lib/tvtime-import/diagnostics-detail/exportPipelineDiagnostic";
import type { FullPipelineTrace } from "@/lib/tvtime-import/diagnostics-detail/fullPipelineAudit";
import { checkAndFixConsistency, type ConsistencyResult } from "@/lib/tvtime-import/audit/consistency";
import { buildSnapshot, saveSnapshot, determineImportType } from "@/lib/tvtime-import/snapshot/snapshotStore";
import type { AuditReport } from "@/lib/tvtime-import/audit/types";
import { createClient } from "@/lib/supabase/client";
import { useImportProgress } from "@/lib/tvtime-import/progress/useImportProgress";
import type {
  ImportOptions,
  ImportSummary,
  LibraryMergeStrategy,
  ParsedArchive,
  ShowMatch,
} from "@/lib/tvtime-import/mapping/types";
import { CelebrationScreen } from "./CelebrationScreen";

type Step = "landing" | "processing" | "invalid" | "confirm" | "importing" | "import-error" | "done";

/**
 * TASK-027.5 — reformulação do fluxo: a seleção manual DEIXOU de
 * bloquear a importação. Antes, achar 1+ série ambígua interrompia
 * tudo até o usuário resolver cada uma. Agora: as ambíguas vão pra
 * `pendingStorage` (localStorage) e o usuário segue direto pra
 * confirmação/importação só com o que já foi resolvido
 * automaticamente — "as pendências ficam pra depois", exatamente
 * como pedido. A resolução delas vira uma tela separada
 * (`/import/tvtime/pending`), acessível quando o usuário quiser,
 * nunca no meio do fluxo principal.
 *
 * Item 17 continua valendo: toda lógica de parsing/matching/
 * importação mora em `lib/tvtime-import/`, isolada; este componente
 * só orquestra.
 */
export function TvTimeImportWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("landing");
  const [parsed, setParsed] = useState<ParsedArchive | null>(null);
  const [matches, setMatches] = useState<ShowMatch[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    importLibrary: true,
    importEpisodes: true,
    restoreProgress: true,
    mergeStrategy: "merge",
  });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [pipelineTraces, setPipelineTraces] = useState<FullPipelineTrace[] | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Lendo arquivo…");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const diagnosticsRef = useRef<ImportDiagnostics | null>(null);
  const matchProgress = useImportProgress();
  const importProgress = useImportProgress();

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      console.warn("[tvtime-import] Arquivo selecionado não é .zip:", file.name);
      setStep("invalid");
      return;
    }

    setStep("processing");
    setProcessingLabel("Lendo ZIP…");
    console.log("[tvtime-import] Lendo ZIP...", file.name, `${(file.size / 1024).toFixed(0)}KB`);
    const diagnostics = new ImportDiagnostics();
    diagnosticsRef.current = diagnostics;

    try {
      const extracted = await extractArchive(file);
      console.log("[tvtime-import] Arquivos encontrados no zip:", extracted.allFileNames);

      const validation = validateArchive(extracted);
      diagnostics.recordArchive(extracted.allFileNames, validation.missingFiles, validation.possibleFormatChange);

      if (!validation.valid) {
        if (validation.possibleFormatChange) {
          console.warn(
            "[tvtime-import] Nenhum arquivo CSV conhecido encontrado — o TV Time já mudou esse formato antes (ver /docs/tvtime-gdpr.md). Pode ser um export em JSON."
          );
        } else {
          console.warn("[tvtime-import] Arquivo inválido — tracking-prod-records-v2.csv não encontrado.");
        }
        setStep("invalid");
        return;
      }
      if (validation.missingFiles.length > 0) {
        console.warn("[tvtime-import] Arquivos conhecidos ausentes (não impede a importação):", validation.missingFiles);
      }

      setProcessingLabel("Organizando suas séries…");
      const archive = buildParsedArchive(extracted, {
        onFileParsed: (f, rowCount) => diagnostics.recordFileParsed(f, rowCount),
      });
      setParsed(archive);
      console.log(`[tvtime-import] ${archive.shows.length} séries encontradas`);

      setProcessingLabel("Buscando suas séries no TMDB…");
      matchProgress.reset(archive.shows.length);
      const results = await matchAllShows(archive.shows, (done) => matchProgress.update(done));
      setMatches(results);

      const pending = results.filter((match) => match.status === "ambiguous" || match.status === "not_found");
      console.log(
        `[tvtime-import] ${results.length - pending.length} identificadas automaticamente, ${pending.length} ficam pendentes (resolvíveis depois, sem bloquear)`
      );

      if (pending.length > 0) {
        savePendingMatches(pending);
      }
      setPendingCount(pending.length);
      setStep("confirm");
    } catch (error) {
      console.error("[tvtime-import] Falha ao processar o arquivo — etapa: leitura/parsing/matching.", error);
      setStep("invalid");
    }
  }

  async function handleImport() {
    setStep("importing");
    setImportError(null);
    const resolvableCount = matches.filter((match) => match.tmdbId !== null).length;
    importProgress.reset(resolvableCount);
    console.log(`[tvtime-import] Importação iniciada — ${resolvableCount} séries resolvidas`);

    try {
      const { summary: result, auditRecords, fullPipelineTraces } = await runImport(matches, options, (current) => {
        importProgress.update(current.index, current.name);
        console.log(`[tvtime-import] Importando série ${current.index}/${current.total}: ${current.name}`);
      });

      console.log("[tvtime-import] Importação concluída", result);
      void logImportTelemetry(matches, result);

      diagnosticsRef.current?.print({
        showsFound: parsed?.shows.length ?? 0,
        moviesFound: 0,
        episodesFound: parsed?.shows.reduce((sum, show) => sum + show.totalWatchEvents, 0) ?? 0,
        favoritesFound: parsed?.favoriteCount ?? 0,
        showsAutoMatched: matches.filter((match) => match.status === "matched").length,
        showsManuallyResolved: matches.filter((match) => match.status === "resolved").length,
        showsNotFound: result.notFoundShows,
        episodesImported: result.importedEpisodes,
        pendingReviewCount: result.pendingReviewCount,
      });

      // TASK-027D, item 6 — checagem/correção automática, sempre (não só em dev): nunca exige intervenção do usuário.
      const {
        data: { user: currentUser },
      } = await createClient().auth.getUser();
      let consistency: ConsistencyResult = { orphanedEpisodeSeries: 0, fixedOrphans: 0 };
      if (currentUser) {
        consistency = await checkAndFixConsistency(currentUser.id);
        if (consistency.fixedOrphans > 0) {
          console.warn(`[tvtime-import] ${consistency.fixedOrphans} inconsistência(s) corrigida(s) automaticamente`);
        }
      }

      if (parsed) {
        const report = buildAuditReport(parsed, auditRecords, result.elapsedSeconds);
        printAuditMode(report);
        setAuditReport(report);
        setPipelineTraces(fullPipelineTraces);

        // Item 8 — relatório final, sempre impresso (não é "modo dev", é o resultado da importação em si).
        printFinalReport(report, consistency.fixedOrphans);

        // Itens 3/4 — snapshot + histórico.
        const importType = await determineImportType();
        await saveSnapshot(buildSnapshot(report, importType));
      }

      setSummary(result);
      setStep("done");
    } catch (error) {
      console.error("[tvtime-import] Falha ao importar — etapa: gravação no Supabase.", error);
      setImportError("Não foi possível concluir a importação agora. Tente de novo.");
      setStep("import-error");
    }
  }

  /**
   * "Nunca bloquear a experiência principal" — sai da tela de
   * importação agora, mas a promise de `handleImport` (já em
   * andamento) continua rodando no mesmo contexto JS da aba até
   * terminar. Limitação real que precisa ficar clara: isso NÃO é um
   * job de servidor — se a aba fechar, a importação para no meio.
   * Um job de verdade exigiria fila/Edge Function no backend, o que
   * é uma tarefa à parte.
   */
  function handleEnterAppNow() {
    router.push("/series");
  }

  // ---------------------------------------------------------------
  if (step === "landing") {
    return (
      <div className="flex min-h-[80dvh] w-full flex-col items-center justify-center px-6 text-center md:mx-auto md:max-w-[430px]">
        <h1 className="text-2xl font-bold text-text">Migre do TV Time em menos de 2 minutos</h1>
        <p className="mt-3 text-sm text-muted">
          Importe automaticamente suas séries, episódios assistidos, favoritos e progresso usando o arquivo oficial
          exportado pelo TV Time.
        </p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-8 flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-background transition-transform active:scale-[0.96]"
        >
          📁 Selecionar arquivo .zip
        </button>
        <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleFileSelected} />

        <div className="mt-8 w-full max-w-xs">
          <p className="text-sm font-medium text-text">Ainda não tem seu arquivo?</p>
          <p className="mt-1 text-xs text-muted">
            Receba gratuitamente seu arquivo oficial do TV Time para importar toda sua biblioteca.
          </p>

          <a
            href="https://gdpr.tvtime.com/gdpr/self-service"
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary py-3 text-sm font-semibold text-primary transition-transform active:scale-[0.96]"
          >
            📥 Receber arquivo do TV Time
          </a>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    const showMatchProgress = processingLabel.includes("TMDB") && matchProgress.progress.total > 0;
    return (
      <div className="flex min-h-[80dvh] w-full flex-col items-center justify-center px-6 text-center md:mx-auto md:max-w-[430px]">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/30" aria-hidden="true" />
        <p className="mt-4 text-sm text-text">{processingLabel}</p>
        {showMatchProgress && (
          <p className="mt-1 text-xs text-muted">
            {matchProgress.progress.done} de {matchProgress.progress.total}
          </p>
        )}
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <div className="flex min-h-[80dvh] w-full flex-col items-center justify-center px-6 text-center md:mx-auto md:max-w-[430px]">
        <AlertTriangle className="h-10 w-10 text-danger" strokeWidth={1.5} />
        <p className="mt-4 text-sm font-semibold text-text">Arquivo inválido.</p>
        <p className="mt-1 text-xs text-muted">Selecione o arquivo GDPR oficial do TV Time.</p>
        <button
          type="button"
          onClick={() => setStep("landing")}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm text-text"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (step === "import-error") {
    return (
      <div className="flex min-h-[80dvh] w-full flex-col items-center justify-center px-6 text-center md:mx-auto md:max-w-[430px]">
        <AlertTriangle className="h-10 w-10 text-danger" strokeWidth={1.5} />
        <p className="mt-4 text-sm font-semibold text-text">{importError}</p>
        <button
          type="button"
          onClick={() => setStep("confirm")}
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm text-text"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (step === "confirm" && parsed) {
    const resolvedCount = matches.filter((match) => match.tmdbId !== null).length;
    const totalEpisodes = matches
      .filter((match) => match.tmdbId !== null)
      .reduce((sum, match) => sum + match.show.totalWatchEvents, 0);

    return (
      <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
        <h1 className="mb-4 text-xl font-bold text-text">Encontramos:</h1>

        <div className="mb-6 space-y-1 text-sm text-text">
          <p>📺 {resolvedCount} séries identificadas automaticamente</p>
          <p>📺 {totalEpisodes.toLocaleString("pt-BR")} episódios</p>
          <p className="text-muted">
            ❤️ {parsed.favoriteCount} favoritos encontrados (ainda não suportado — ver nota abaixo)
          </p>
          {pendingCount > 0 && (
            <p className="text-warning">
              ⚠ {pendingCount} {pendingCount === 1 ? "série precisa" : "séries precisam"} da sua ajuda — pode
              resolver depois, sem esperar agora.
            </p>
          )}
        </div>

        <div className="mb-6 space-y-1 rounded-lg border border-border bg-surface p-1">
          <label className="flex items-center gap-3 px-3 py-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={options.importLibrary}
              onChange={(event) => setOptions((current) => ({ ...current, importLibrary: event.target.checked }))}
            />
            Importar biblioteca
          </label>
          <label className="flex items-center gap-3 px-3 py-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={options.importEpisodes}
              onChange={(event) => setOptions((current) => ({ ...current, importEpisodes: event.target.checked }))}
            />
            Importar episódios
          </label>
          <label className="flex items-center gap-3 px-3 py-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={options.restoreProgress}
              onChange={(event) => setOptions((current) => ({ ...current, restoreProgress: event.target.checked }))}
            />
            Restaurar progresso
          </label>
          <label className="flex items-center gap-3 px-3 py-2.5 text-xs text-muted opacity-60">
            <input type="checkbox" disabled />
            Importar favoritos (em breve)
          </label>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-xs font-medium text-muted">Já tenho séries na minha biblioteca:</p>
          <div className="flex gap-2">
            {(["merge", "replace"] as LibraryMergeStrategy[]).map((strategy) => (
              <button
                key={strategy}
                type="button"
                onClick={() => setOptions((current) => ({ ...current, mergeStrategy: strategy }))}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                  options.mergeStrategy === strategy
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted"
                }`}
              >
                {strategy === "merge" ? "Mesclar com minha biblioteca" : "Substituir tudo"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleImport}
          className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-background transition-transform active:scale-[0.96]"
        >
          Importar agora
        </button>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="flex min-h-[80dvh] w-full flex-col items-center justify-center px-6 text-center md:mx-auto md:max-w-[430px]">
        <p className="mb-4 text-sm font-medium text-text">Importando…</p>
        <div className="mb-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${importProgress.percentage}%` }}
          />
        </div>
        <p className="text-xs text-muted">{importProgress.percentage}%</p>
        {importProgress.progress.currentLabel && (
          <p className="mt-4 text-sm text-text">{importProgress.progress.currentLabel}</p>
        )}

        <button type="button" onClick={handleEnterAppNow} className="mt-8 text-xs text-muted underline">
          Entrar no SeenList agora (a importação continua em segundo plano nesta aba)
        </button>
      </div>
    );
  }

  if (step === "done" && summary) {
    return (
      <div>
        <CelebrationScreen
          showCount={summary.importedShows}
          episodeCount={summary.importedEpisodes}
          favoriteCount={parsed?.favoriteCount ?? 0}
          pendingCount={pendingCount}
        />
        {AUDIT_MODE_ENABLED && auditReport && (
          <div className="mx-auto flex max-w-xs flex-col gap-2 px-6 pb-8">
            <p className="text-center text-[10px] uppercase tracking-wide text-muted">
              Modo desenvolvimento — não aparece em produção
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadAuditJson(auditReport)}
                className="flex-1 rounded-lg border border-border py-2 text-xs text-text"
              >
                Exportar Auditoria (JSON)
              </button>
              <button
                type="button"
                onClick={() => downloadAuditMarkdown(auditReport)}
                className="flex-1 rounded-lg border border-border py-2 text-xs text-text"
              >
                Exportar Auditoria (MD)
              </button>
            </div>
            {pipelineTraces && (
              <button
                type="button"
                onClick={() => downloadPipelineDiagnostic(pipelineTraces)}
                className="rounded-lg border border-primary py-2 text-xs font-semibold text-primary"
              >
                Baixar diagnóstico da importação
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <Link href="/profile" className="text-sm text-muted underline">
        Voltar para o Perfil
      </Link>
    </div>
  );
}
