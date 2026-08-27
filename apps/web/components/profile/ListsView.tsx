"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ListChecks, ChevronRight } from "lucide-react";
import { useMyLists, useCreateList } from "@/lib/queries/lists";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PageError } from "../media/PageError";

/**
 * TASK-029, item 1 — "botão sempre visível, não escondido no menu".
 * Fica fixo no topo da tela, fora de qualquer lista/scroll de menu.
 */
export function ListsView() {
  const { data: lists, isLoading, isError, refetch } = useMyLists();
  const createList = useCreateList();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const { t } = useTranslation();

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createList.mutate(trimmed, {
      onSuccess: () => {
        setName("");
        setShowForm(false);
      },
    });
  }

  return (
    <div>
      {/* "Vidro" (redesign âmbar/vidro, 2026-08-26 — Listas) — virou a mesma pílula "gel" âmbar do CTA primário já usado no Explorar/Perfil/botão de comentários (EpisodeDetailView.tsx), em vez do `bg-primary` chapado. */}
      <button
        type="button"
        onClick={() => setShowForm((current) => !current)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-3 text-sm font-bold text-background shadow-lg backdrop-blur-[10px] backdrop-saturate-[160%] transition-transform active:scale-[0.98]"
        style={{
          background: "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
        }}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        {t("profile.createNewList")}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("profile.listName")}
            maxLength={80}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim() || createList.isPending}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {createList.isPending ? t("profile.creating") : t("common.save")}
          </button>
        </form>
      )}

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      )}

      {isError && <PageError message={t("profile.errorLoadLists")} onRetry={() => refetch()} />}

      {!isLoading && !isError && lists && lists.length === 0 && (
        <p className="px-1 text-sm text-muted">{t("profile.emptyLists")}</p>
      )}

      {lists && lists.length > 0 && (
        <div className="space-y-2">
          {lists.map((list) => (
            // "Vidro" (mesmo padrão de ProfileSectionRow.tsx) — "glass-row", em vez de `border-border bg-surface` opaco.
            <Link
              key={list.id}
              href={`/profile/lists/${list.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3.5 backdrop-blur-[18px] backdrop-saturate-[180%] transition-colors hover:border-primary/40"
              style={{
                background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
              }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12">
                <ListChecks className="h-4 w-4 text-primary" strokeWidth={2} />
              </span>
              <span className="flex-1 text-sm font-medium text-text">{list.name}</span>
              <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
