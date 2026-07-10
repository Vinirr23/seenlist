"use client";

import { useState } from "react";
import { Plus, ListChecks } from "lucide-react";
import { useMyLists, useCreateList } from "@/lib/queries/lists";

/**
 * TASK-029, item 1 — "botão sempre visível, não escondido no menu".
 * Fica fixo no topo da tela, fora de qualquer lista/scroll de menu.
 */
export function ListsView() {
  const { data: lists, isLoading, isError } = useMyLists();
  const createList = useCreateList();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

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
      <button
        type="button"
        onClick={() => setShowForm((current) => !current)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-background transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Criar nova lista
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome da lista"
            maxLength={80}
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!name.trim() || createList.isPending}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {createList.isPending ? "Criando…" : "Salvar"}
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

      {isError && <p className="text-sm text-muted">Não foi possível carregar suas listas agora.</p>}

      {!isLoading && !isError && lists && lists.length === 0 && (
        <p className="px-1 text-sm text-muted">Você ainda não criou nenhuma lista.</p>
      )}

      {lists && lists.length > 0 && (
        <div className="space-y-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5"
            >
              <ListChecks className="h-5 w-5 text-primary" strokeWidth={2} />
              <span className="text-sm font-medium text-text">{list.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
