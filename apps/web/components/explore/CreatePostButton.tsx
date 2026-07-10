"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useCreateTextPost } from "@/lib/queries/posts";
import { hapticTick } from "@/lib/haptics";

const MAX_LENGTH = 500;

/**
 * TASK-059 (fase 2) — só cria posts type="text". O composer completo
 * (imagem/GIF/poster/enquete/review/lista/spoiler, do pedido
 * original) é fase futura — construir isso tudo de uma vez arriscaria
 * qualidade, como já combinado.
 */
export function CreatePostButton() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const createPost = useCreateTextPost();

  function handleSubmit() {
    if (!body.trim()) return;
    hapticTick();
    createPost.mutate(body.trim(), {
      onSuccess: () => {
        setBody("");
        setOpen(false);
      },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticTick();
          setOpen(true);
        }}
        aria-label="Criar post"
        className="fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-background shadow-lg active:scale-95"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 md:items-center">
          <div className="w-full max-w-[430px] rounded-t-2xl bg-surface p-4 md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-text">Novo post</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted">
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
              placeholder="O que você está assistindo?"
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {body.length}/{MAX_LENGTH}
            </p>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!body.trim() || createPost.isPending}
              className="mt-2 w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
            >
              {createPost.isPending ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
