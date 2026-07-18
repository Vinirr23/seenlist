"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, X, Clapperboard } from "lucide-react";
import { useMyLists, useListItems, useRemoveFromList, useDeleteList } from "@/lib/queries/lists";
import { tmdbImage } from "@/lib/tmdb/image";
import { EmptyState } from "../search/EmptyState";

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
          aria-label="Voltar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 truncate text-xl font-bold text-text">{list?.name ?? "Lista"}</h1>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          aria-label="Apagar lista"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {confirmingDelete && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3">
          <p className="mb-3 text-sm text-text">Apagar essa lista? Os itens dentro dela somem junto (sua biblioteca não é afetada).</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteList}
              disabled={deleteList.isPending}
              className="flex-1 rounded-lg bg-danger py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {deleteList.isPending ? "Apagando..." : "Apagar"}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-3 gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {!isLoading && items && items.length === 0 && (
        <EmptyState message='Essa lista ainda não tem nada. Adicione pelo menu "..." na página de uma série ou filme.' />
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const posterUrl = tmdbImage(item.posterPath, "w342");
            const href = item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`;
            return (
              <div key={item.id} className="relative">
                <Link href={href} className="block">
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface">
                    {posterUrl ? (
                      <Image src={posterUrl} alt={item.title} fill sizes="(min-width: 768px) 130px, 30vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-surface to-background">
                        <Clapperboard className="h-6 w-6 text-muted/40" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => removeFromList.mutate(item.id)}
                  aria-label={`Remover ${item.title} da lista`}
                  className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
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
