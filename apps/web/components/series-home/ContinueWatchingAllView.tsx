"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useContinueWatchingSeries } from "@/lib/queries/continueWatchingSeries";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { UpToDatePendingGate } from "./UpToDatePendingGate";
import { PosterGrid } from "../profile/PosterGrid";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";

/**
 * A PEDIDO (2026-09-01 — "sobre o limite de 8 cards na home, me
 * relembra a solução") — tela NOVA, "Ver tudo" de "Continue
 * assistindo". Home (`MinhaListaSection.tsx`) mostra só as 8
 * primeiras (`CONTINUE_ASSISTINDO_LIMIT`); esta tela mostra TODAS,
 * sem corte — reaproveitando o mesmo hook (`useContinueWatchingSeries`,
 * sem `limit`), pra garantir o EXATO mesmo filtro/ordenação/
 * confirmação de pendência dos dois lados (ver comentário completo
 * no hook).
 *
 * SEM CONSULTA NOVA AO BANCO — `useLibraryItems()` (por baixo do
 * hook) já busca a biblioteca inteira de uma vez; o React Query
 * cacheia por `queryKey`, então abrir esta tela depois de já ter
 * visitado a Home é instantâneo (cache hit), e abrir direto (sem
 * passar pela Home) dispara a MESMA busca de sempre sozinha — nada
 * de paginação de servidor pra esta tela.
 *
 * Mesmo alternador grade/lista da Home (`useViewModePreference("series-library")`
 * — MESMA chave, então o modo escolhido aqui é o mesmo já escolhido
 * na Home, sem preferência própria e desalinhada) e mesmo card/grade
 * (`ContinueWatchingCard`/`PosterGrid`) — visual idêntico, só sem o
 * corte de 8.
 */
export function ContinueWatchingAllView() {
  const { t } = useTranslation();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("series-library");
  const {
    isLoading,
    isError,
    error,
    refetch,
    visibleContinueWatching,
    upToDateCandidateIds,
    handlePendingResolved,
    stillResolvingPending,
  } = useContinueWatchingSeries();

  // Mesmo mecanismo de `MinhaListaSection.tsx` (ver comentário lá) —
  // só liga a animação de layout do `motion` enquanto pelo menos 1
  // card está de fato marcando/desmarcando assistido, evitando a
  // barra de rolagem dupla (bug real já corrigido, mesma causa raiz
  // se ficasse sempre ligado nos N cards desta tela).
  const [activeTransitionCount, setActiveTransitionCount] = useState(0);
  const handleTransitionActiveChange = useCallback((active: boolean) => {
    setActiveTransitionCount((count) => Math.max(0, count + (active ? 1 : -1)));
  }, []);
  const layoutActive = activeTransitionCount > 0;

  useEffect(() => {
    if (isError) {
      console.error("[ContinueWatchingAllView] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  return (
    <div className="w-full px-2 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          {/* Mesmo padrão "vidro" do botão de voltar de `DiscoverAllView.tsx`. */}
          <Link
            href="/series"
            aria-label={t("common.back")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-text backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90"
            style={{
              background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
            }}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          </Link>
          <h1 className="text-xl font-bold text-text">{t("seriesHome.continueWatching")}</h1>
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Gates invisíveis — mesmo papel do que em `MinhaListaSection.tsx`, só que aqui pra TODAS as candidatas "em dia", não só as 8 da Home. */}
      {upToDateCandidateIds.map((seriesId) => (
        <UpToDatePendingGate key={seriesId} seriesId={seriesId} onResolved={handlePendingResolved} />
      ))}

      {!viewModeReady ? null : isLoading || stillResolvingPending ? (
        <HomeSkeleton variant={viewMode === "grid" ? "grid" : "list"} />
      ) : visibleContinueWatching.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t("seriesHome.emptyCaughtUpTitle")}</p>
      ) : viewMode === "grid" ? (
        <PosterGrid items={visibleContinueWatching} />
      ) : (
        <div>
          {visibleContinueWatching.map((item, index) => (
            <ContinueWatchingCard
              key={item.id}
              item={item}
              priorityIndex={index}
              layoutActive={layoutActive}
              onTransitionActiveChange={handleTransitionActiveChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
