"use client";

import { useEffect, useState } from "react";
import { Heart, ListPlus, Clock, PauseCircle, Trash2, Share2, X, ArrowLeft, Check, Plus } from "lucide-react";
import type { LibraryStatus } from "@seenlist/types";
import { useSetSeriesStatus } from "@/lib/queries/series-status";
import { useRemoveLibraryItem } from "@/lib/queries/library";
import { useIsFavorite, useToggleFavorite } from "@/lib/queries/favorites";
import { useMyLists, useCreateList, useAddToList } from "@/lib/queries/lists";
import { useToast } from "@/lib/toast/ToastProvider";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface SeriesQuickActionsSheetProps {
  seriesId: number;
  seriesTitle: string;
  currentStatus: LibraryStatus;
  onClose: () => void;
}

type SheetView = "menu" | "pick-list";

/**
 * Menu de ações rápidas ao pressionar e segurar um pôster —
 * restrito às 6 opções pedidas: favoritar, adicionar a lista,
 * assistir depois, parar de assistir, remover série, compartilhar.
 * "Assistindo" e "Concluída" saíram daqui de propósito — não é mais
 * o menu de trocar QUALQUER status, é o conjunto específico pedido.
 * `useSetSeriesStatus`/`useRemoveLibraryItem` continuam sendo as
 * mesmas mutations de sempre, só a lista de opções mudou.
 *
 * Tradução (3º lote) — este era o menu "Mais opções" que ainda tinha
 * escapado dos lotes anteriores (só os botões principais da tela de
 * série/filme tinham sido cobertos, não este sheet).
 */
export function SeriesQuickActionsSheet({
  seriesId,
  seriesTitle,
  currentStatus,
  onClose,
}: SeriesQuickActionsSheetProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<SheetView>("menu");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewListForm, setShowNewListForm] = useState(false);

  const setStatus = useSetSeriesStatus(seriesId);
  const removeItem = useRemoveLibraryItem();
  const { data: isFavorite } = useIsFavorite("series", seriesId);
  const toggleFavorite = useToggleFavorite("series", seriesId);
  const { data: lists, isLoading: listsLoading } = useMyLists();
  const createList = useCreateList();
  const addToList = useAddToList();
  const toast = useToast();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSetStatus(status: LibraryStatus) {
    hapticTick();
    setStatus.mutate(
      { status, currentStatus },
      {
        onSuccess: () => toast.success(currentStatus === status ? t("toast.seriesRemoved") : t("toast.seriesAdded")),
        onError: () => toast.error(t("toast.connectionError")),
      }
    );
    onClose();
  }

  function handleToggleFavorite() {
    hapticTick();
    toggleFavorite.mutate(Boolean(isFavorite));
    onClose();
  }

  function handleConfirmRemove() {
    hapticTick();
    removeItem.mutate(
      { mediaType: "series", id: seriesId },
      {
        onSuccess: () => toast.success(t("toast.seriesRemoved")),
        onError: () => toast.error(t("toast.connectionError")),
      }
    );
    onClose();
  }

  function handleAddToList(listId: string) {
    hapticTick();
    addToList.mutate({ listId, mediaType: "series", mediaId: seriesId });
    onClose();
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
    const url = `${window.location.origin}/series/${seriesId}`;
    hapticTick();
    if (navigator.share) {
      try {
        await navigator.share({ title: seriesTitle, url });
        onClose();
        return;
      } catch {
        // usuário cancelou o share nativo — cai pro fallback de copiar, não trata como erro
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("toast.linkCopied"));
    } catch (error) {
      console.error("[series] Falha ao copiar link da série", error);
      toast.error(t("toast.linkCopyError"));
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-[430px] rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {confirmingRemove ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-text">{t("removeSeries.confirmTitle")}</p>
            <p className="text-xs text-muted">{t("removeSeries.confirmMessage", { title: seriesTitle })}</p>
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
              <p className="truncate text-xs font-medium text-muted">{t("list.addTo", { title: seriesTitle })}</p>
            </div>

            {listsLoading && <p className="px-3 py-3 text-sm text-muted">{t("common.loading")}</p>}

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
            <p className="mb-2 truncate px-2 text-xs font-medium text-muted">{seriesTitle}</p>

            <button
              type="button"
              onClick={handleToggleFavorite}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
            >
              <Heart className={isFavorite ? "h-4 w-4 fill-current text-danger" : "h-4 w-4"} strokeWidth={2} />
              {isFavorite ? t("action.favorite.remove") : t("action.favorite.add")}
            </button>

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
              onClick={() => handleSetStatus("want_to_watch")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
            >
              <Clock className="h-4 w-4" strokeWidth={2} />
              {t("action.watchLater")}
            </button>

            <button
              type="button"
              onClick={() => handleSetStatus("paused")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
            >
              <PauseCircle className="h-4 w-4" strokeWidth={2} />
              {t("action.stopWatching")}
            </button>

            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-danger hover:bg-background"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              {t("action.removeSeries")}
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
              onClick={onClose}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-medium text-muted"
            >
              <X className="h-4 w-4" strokeWidth={2} />
              {t("common.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
