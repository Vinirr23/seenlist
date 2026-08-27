"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, X, Clapperboard } from "lucide-react";
import { useMyLists, useListItems, useRemoveFromList, useDeleteList } from "@/lib/queries/lists";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { EmptyState } from "../search/EmptyState";
import { ConfirmDialog } from "../series/ConfirmDialog";

/**
 * TASK-172 — tela que faltava: dava pra criar lista e adicionar item
 * (pelo menu "..." de série/filme), mas nunca dava pra abrir uma
 * lista e ver o que tinha dentro. O nome nem era clicável antes
 * (`ListsView.tsx`, corrigido junto).
 */
export function ListDetailView({ listId }: { listId: string }) {
  const router = useRouter();
  const { data: lists } = useMyLists();
  const { data: items, isLoading } = useListItems(listId);
  const removeFromList = useRemoveFromList(listId);
  const deleteList = useDeleteList();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { t } = useTranslation();

  const list = lists?.find((l) => l.id === listId);

  function handleDeleteList() {
    deleteList.mutate(listId, {
      onSuccess: () => router.push("/profile/lists"),
    });
  }

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/profile/lists"
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 truncate text-xl font-bold text-text">{list?.name ?? t("profile.list")}</h1>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          aria-label={t("profile.deleteList")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Listas) — reaproveitado o `ConfirmDialog` compartilhado (mesmo painel escuro translúcido usado em Configurações/Episódio) em vez de um painel próprio com fundo `bg-danger/10` opaco. */}
      {confirmingDelete && (
        <ConfirmDialog
          title={t("profile.deleteList")}
          message={t("profile.confirmDeleteList")}
          onDismiss={() => setConfirmingDelete(false)}
          actions={[
            { label: t("common.cancel"), onClick: () => setConfirmingDelete(false) },
            {
              label: deleteList.isPending ? t("profile.deleting") : t("feed.deletePost"),
              onClick: handleDeleteList,
              variant: "danger",
            },
          ]}
        />
      )}

      {isLoading && (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {!isLoading && items && items.length === 0 && (
        <EmptyState message={t("profile.emptyListItems")} />
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const posterUrl = tmdbImage(item.posterPath, "w342");
            const href = item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`;
            return (
              <div key={item.id} className="relative">
                <Link href={href} className="block">
                  {/* "Vidro" (mesmo padrão de DiscoverCard.tsx/PosterGrid.tsx) — borda clara + blur/saturação + gradiente radial translúcido, em vez de `bg-surface` opaco. */}
                  <div
                    className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
                    style={{
                      background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                    }}
                  >
                    {posterUrl ? (
                      <Image src={posterUrl} alt={item.title} fill sizes="(min-width: 768px) 130px, 30vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Clapperboard className="h-6 w-6 text-muted/40" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                </Link>
                {/* "Vidro" (mesmo padrão do botão-círculo mini do CommentComposer.tsx) — versão mini do GLASS_ICON_BTN, em vez de `bg-black/70` opaco. */}
                <button
                  type="button"
                  onClick={() => removeFromList.mutate(item.id)}
                  aria-label={t("profile.removeFromList", { title: item.title })}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-text shadow-md shadow-black/25 backdrop-blur-md backdrop-saturate-150"
                  style={{
                    background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
                  }}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
