"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import type { TraktImportData } from "@/app/api/trakt/data/route";
import { importTraktData, type TraktImportResult } from "@/lib/trakt/import";

type Step = "landing" | "loading" | "confirm" | "importing" | "done" | "error";

/**
 * TASK-171 — mesmo espírito do assistente do TV Time
 * (`TvTimeImportWizard.tsx`), bem mais simples porque o Trakt já
 * entrega dado exato (sem reconstrução/confiança/revisão manual) e
 * ID do TMDB pronto (sem etapa de "achar a série certa"). MESCLA
 * com a biblioteca (decisão confirmada, diferente do TV Time) — sem
 * tela de confirmação destrutiva, porque não é destrutivo.
 */
export function TraktImportWizard({ authorizeUrl }: { authorizeUrl: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState<Step>("landing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importData, setImportData] = useState<TraktImportData | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<TraktImportResult | null>(null);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) {
      setErrorMessage(
        urlError === "falha_autenticacao"
          ? "Não foi possível conectar com o Trakt agora. Tenta de novo."
          : "A autorização foi cancelada ou falhou."
      );
      setStep("error");
      return;
    }

    if (searchParams.get("connected") === "1") {
      setStep("loading");
      fetch("/api/trakt/data")
        .then(async (response) => {
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error ?? "Falha ao buscar dados do Trakt.");
          }
          return response.json() as Promise<TraktImportData>;
        })
        .then((data) => {
          setImportData(data);
          setStep("confirm");
        })
        .catch((error) => {
          console.error("[TraktImportWizard] Falha ao buscar dados", error);
          setErrorMessage("Não foi possível buscar seus dados do Trakt agora. Tenta conectar de novo.");
          setStep("error");
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport() {
    if (!importData) return;
    setStep("importing");
    try {
      const importResult = await importTraktData(importData, setProgressMessage);
      setResult(importResult);
      setStep("done");
    } catch (error) {
      console.error("[TraktImportWizard] Falha ao importar", error);
      setErrorMessage("Algo deu errado ao gravar os dados na sua biblioteca. Tenta de novo.");
      setStep("error");
    }
  }

  const moviesWatchedCount = importData?.movies.filter((m) => m.watched).length ?? 0;
  const moviesWantToWatchCount = importData?.movies.filter((m) => !m.watched && m.wantToWatch).length ?? 0;
  const seriesWithEpisodesCount = importData?.series.filter((s) => s.watchedEpisodes.length > 0).length ?? 0;
  const totalEpisodesCount = importData?.series.reduce((sum, s) => sum + s.watchedEpisodes.length, 0) ?? 0;
  const seriesWantToWatchCount =
    importData?.series.filter((s) => s.watchedEpisodes.length === 0 && s.wantToWatch).length ?? 0;
  const ratingsCount =
    (importData?.movies.filter((m) => m.rating !== null).length ?? 0) +
    (importData?.series.filter((s) => s.rating !== null).length ?? 0);

  return (
    <div className="mx-auto flex min-h-[80dvh] w-full max-w-[430px] flex-col justify-center px-6 py-10 text-center">
      {step === "landing" && (
        <>
          <h1 className="mb-2 text-xl font-bold text-text">Importar do Trakt</h1>
          <p className="mb-8 text-sm text-muted">
            Conecta sua conta do Trakt pra trazer filmes e séries assistidos, avaliações e sua watchlist — direto,
            sem precisar de arquivo nenhum. Mescla com sua biblioteca atual, não substitui nada.
          </p>
          <a
            href={authorizeUrl}
            className="mx-auto flex w-full items-center justify-center rounded-lg bg-primary py-3 text-sm font-bold text-background"
          >
            Conectar com Trakt
          </a>
        </>
      )}

      {step === "loading" && <p className="text-sm text-muted">Buscando seus dados no Trakt...</p>}

      {step === "confirm" && importData && (
        <>
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" strokeWidth={1.5} />
          <h1 className="mb-4 text-lg font-bold text-text">Encontrado na sua conta do Trakt</h1>
          <div className="mb-6 space-y-1.5 rounded-lg border border-border bg-surface p-4 text-left text-sm text-text">
            <p>
              🎬 <span className="font-semibold">{moviesWatchedCount}</span> filmes assistidos
            </p>
            {moviesWantToWatchCount > 0 && (
              <p>
                🕐 <span className="font-semibold">{moviesWantToWatchCount}</span> filmes na watchlist
              </p>
            )}
            <p>
              📺 <span className="font-semibold">{seriesWithEpisodesCount}</span> séries, {totalEpisodesCount}{" "}
              episódios assistidos
            </p>
            {seriesWantToWatchCount > 0 && (
              <p>
                🕐 <span className="font-semibold">{seriesWantToWatchCount}</span> séries na watchlist
              </p>
            )}
            {ratingsCount > 0 && (
              <p>
                ⭐ <span className="font-semibold">{ratingsCount}</span> avaliações
              </p>
            )}
          </div>
          {importData.skippedCount > 0 && (
            <p className="mb-4 text-xs text-muted">
              {importData.skippedCount} itens não tinham correspondência com o TMDB e não puderam ser importados.
            </p>
          )}
          <button
            type="button"
            onClick={handleImport}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background"
          >
            Importar pra minha biblioteca
          </button>
        </>
      )}

      {step === "importing" && (
        <>
          <p className="mb-2 text-sm font-medium text-text">Importando...</p>
          <p className="text-xs text-muted">{progressMessage}</p>
        </>
      )}

      {step === "done" && result && (
        <>
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" strokeWidth={1.5} />
          <h1 className="mb-4 text-lg font-bold text-text">Importação concluída!</h1>
          <div className="mb-6 space-y-1.5 rounded-lg border border-border bg-surface p-4 text-left text-sm text-text">
            <p>🎬 {result.moviesWatched} filmes assistidos</p>
            {result.moviesWantToWatch > 0 && <p>🕐 {result.moviesWantToWatch} filmes adicionados à watchlist</p>}
            <p>
              📺 {result.seriesWithEpisodes} séries, {result.episodesImported} episódios
            </p>
            {result.seriesWantToWatch > 0 && <p>🕐 {result.seriesWantToWatch} séries adicionadas à watchlist</p>}
            {result.reviewsImported > 0 && <p>⭐ {result.reviewsImported} avaliações</p>}
          </div>
          <button
            type="button"
            onClick={() => router.push("/series")}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background"
          >
            Ver minha biblioteca
          </button>
        </>
      )}

      {step === "error" && (
        <>
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-danger" strokeWidth={1.5} />
          <p className="mb-6 text-sm text-text">{errorMessage}</p>
          <a
            href={authorizeUrl}
            className="mx-auto flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-medium text-text"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Tentar de novo
          </a>
        </>
      )}
    </div>
  );
}
