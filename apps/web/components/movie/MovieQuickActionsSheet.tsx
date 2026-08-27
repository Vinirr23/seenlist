"use client";

import { useEffect, useState } from "react";
import { ListPlus, Trash2, Share2, X, ArrowLeft, Check, Plus, Send } from "lucide-react";
import { useRemoveLibraryItem } from "@/lib/queries/library";
import { useMyLists, useCreateList, useAddToList } from "@/lib/queries/lists";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useDialogAnimation } from "@/lib/useDialogAnimation";
import { cn } from "@seenlist/utils";
import dynamic from "next/dynamic";

/**
 * AUDITORIA (perf) — mesma correção de `SeriesQuickActionsSheet.tsx`:
 * `RecommendSheet` só é usado quando alguém toca em "Recomendar pra
 * alguém" — a maioria não chega a abrir. `dynamic()` faz o JS desse
 * componente ser baixado só na hora, não no carregamento da página
 * do filme.
 */
const RecommendSheet = dynamic(() => import("../social/RecommendSheet").then((mod) => mod.RecommendSheet), {
  ssr: false,
});

export interface MovieQuickActionsSheetProps {
  movieId: number;
  movieTitle: string;
  onClose: () => void;
}

type SheetView = "menu" | "pick-list";

/**
 * TASK-172 — menu "..." de filme, a pedido explícito ("filme não tem
 * adicionar a lista"). Espelha `SeriesQuickActionsSheet.tsx` (mesmo
 * componente de escolher lista, mesma confirmação de remover), só
 * que sem "favoritar" — pra filme, o coração já é botão principal
 * (`MovieActions.tsx`), duplicar aqui seria redundante. Sem
 * "assistir depois"/"parar de assistir" também — filme só tem
 * assistido/assistir depois/assistindo como status, e os dois
 * primeiros já são botões principais; "assistindo" não é mais
 * escolhido manualmente pra filme, mesma decisão já tomada pra série
 * (não faz parte deste menu).
 */
export function MovieQuickActionsSheet({ movieId, movieTitle, onClose }: MovieQuickActionsSheetProps) {
  const { t } = useTranslation();
  const { mounted, handleClose } = useDialogAnimation(onClose);
  const [view, setView] = useState<SheetView>("menu");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);

  const removeItem = useRemoveLibraryItem();
  const { data: lists, isLoading: listsLoading } = useMyLists();
  const createList = useCreateList();
  const addToList = useAddToList();
  const toast = useToast();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirmRemove() {
    hapticTick();
    removeItem.mutate(
      { mediaType: "movie", id: movieId },
      {
        onSuccess: () => toast.success(t("toast.movieRemoved")),
        onError: () => toast.error(t("toast.connectionError")),
      }
    );
    handleClose();
  }

  function handleAddToList(listId: string) {
    hapticTick();
    addToList.mutate({ listId, mediaType: "movie", mediaId: movieId });
    handleClose();
  }

  function handleCreateAndAdd(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    createList.mutate(trimmed, {
      onSuccess: () => {
        setNewListName("");
        setShowNewListForm(false);
      },
    });
  }

  async function handleShare() {
    const url = `${window.location.origin}/movies/${movieId}`;
    hapticTick();
    if (navigator.share) {
      try {
        await navigator.share({ title: movieTitle, url });
        handleClose();
        return;
      } catch {
        // usuário cancelou o share nativo — cai pro fallback de copiar, não trata como erro
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("toast.linkCopied"));
    } catch (error) {
      console.error("[movie] Falha ao copiar link do filme", error);
      toast.error(t("toast.linkCopyError"));
    }
    handleClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={cn("absolute inset-0 bg-black/60 transition-opacity duration-200", mounted ? "opacity-100" : "opacity-0")}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* "Vidro" (mesmo padrão do dropdown de histórico do SearchBar.tsx) */}
      <div
        className={cn(
          "relative w-full max-w-[430px] rounded-t-2xl border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-[18px] backdrop-saturate-[180%] transition-transform duration-200 ease-out",
          mounted ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)",
        }}
      >
        {confirmingRemove ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-text">{t("removeSeries.confirmTitle")}</p>
            <p className="text-xs text-muted">{t("removeSeries.confirmMessage", { title: movieTitle })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-text"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-text"
              >
                {t("common.remove")}
              </button>
            </div>
          </div>
        ) : view === "pick-list" ? (
          <div className="space-y-1">
            <div className="mb-2 flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => setView("menu")}
                aria-label={t("common.back")}
                className="rounded-lg p-1 text-muted hover:text-text"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <p className="truncate text-xs font-medium text-muted">{t("list.addTo", { title: movieTitle })}</p>
            </div>

            {listsLoading && (
              <div className="space-y-1" aria-busy="true" aria-label={t("common.loading")}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 px-3 py-3">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-surface" />
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface" />
                  </div>
                ))}
              </div>
            )}

            {!listsLoading && lists && lists.length === 0 && !showNewListForm && (
              <p className="px-3 py-2 text-sm text-muted">{t("list.empty")}</p>
            )}

            {lists?.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => handleAddToList(list.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
              >
                <ListPlus className="h-4 w-4" strokeWidth={2} />
                {list.name}
              </button>
            ))}

            {showNewListForm ? (
              <form onSubmit={handleCreateAndAdd} className="flex gap-2 px-1 pt-2">
                <input
                  autoFocus
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder={t("list.namePlaceholder")}
                  maxLength={80}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newListName.trim() || createList.isPending}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  <Check className="h-4 w-4" strokeWidth={2} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewListForm(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-primary hover:bg-background"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                {t("list.createNew")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="mb-2 truncate px-2 text-xs font-medium text-muted">{movieTitle}</p>

            <button
              type="button"
              onClick={() => setView("pick-list")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
            >
              <ListPlus className="h-4 w-4" strokeWidth={2} />
              {t("action.addToList")}
            </button>

            <button
              type="button"
              onClick={() => {
                hapticTick();
                setShowRecommend(true);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
              {t("action.recommend")}
            </button>

            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-danger hover:bg-background"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              {t("action.removeMovie")}
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
            >
              <Share2 className="h-4 w-4" strokeWidth={2} />
              {t("action.share")}
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-medium text-muted"
            >
              <X className="h-4 w-4" strokeWidth={2} />
              {t("common.cancel")}
            </button>
          </div>
        )}
      </div>

      {showRecommend && (
        <RecommendSheet
          mediaType="movie"
          mediaId={movieId}
          mediaTitle={movieTitle}
          onClose={() => setShowRecommend(false)}
        />
      )}
    </div>
  );
}
