"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useCreateTextPost } from "@/lib/queries/posts";
import { hapticTick } from "@/lib/haptics";
import { useHideBottomNav } from "@/lib/layout/bottomNavVisibility";

const MAX_LENGTH = 500;

/**
 * TASK-059 (fase 2) — só cria posts type="text". O composer completo
 * (imagem/GIF/poster/enquete/review/lista/spoiler, do pedido
 * original) é fase futura — construir isso tudo de uma vez arriscaria
 * qualidade, como já combinado.
 *
 * BUG (Web Mobile / iOS Safari) corrigido aqui — recapitulando os 3
 * problemas que estavam misturados num só sintoma ("teclado cobre o
 * botão Postar"):
 *
 * 1. Barra de navegação por cima do modal: `useHideBottomNav(open)`
 *    remove a `<BottomNavigation>` do DOM enquanto este modal está
 *    aberto (ver bottomNavVisibility.tsx) — não dá mais pra ela
 *    aparecer por cima de nada, teclado aberto ou não.
 * 2. `100dvh` em vez de depender só de `inset-0`: o container do
 *    modal (mobile) tem `h-[100dvh]` explícito. `dvh` (dynamic
 *    viewport height) é a unidade que os navegadores atualizam de
 *    verdade quando o teclado abre/fecha — `100vh` fica "preso" no
 *    tamanho de antes do teclado abrir, empurrando conteúdo pra fora
 *    da área visível. Desktop continua com altura pelo conteúdo
 *    (`md:h-auto`), sem herdar esse comportamento — layout de
 *    desktop inalterado.
 * 3. Botão "Postar" sempre alcançável: em vez de fixar o botão com
 *    `position: fixed` (que sofre o mesmo problema do item 2 com o
 *    teclado), o modal virou uma coluna flex
 *    (header / textarea-scrollável / botão) contida dentro do
 *    `h-[100dvh]` do item 2 — o botão fica no fluxo normal, no fim
 *    dessa coluna. Quando o teclado abre e o `dvh` encolhe, a coluna
 *    inteira encolhe junto e o botão continua dentro da área visível,
 *    sem cálculo manual de altura de teclado (que não é confiável
 *    entre Safari iOS/Chrome Android). `env(safe-area-inset-bottom)`
 *    no padding inferior cobre o notch/home indicator do iPhone
 *    quando o teclado NÃO está aberto.
 */
export function CreatePostButton() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const createPost = useCreateTextPost();

  useHideBottomNav(open);

  // Trava o scroll do body por trás do modal — evita o "bounce" do
  // Safari iOS arrastar a página de fundo enquanto o modal (que já
  // tem seu próprio scroll interno, item 3 acima) está aberto.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

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
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 md:items-center">
          <div className="flex h-[100dvh] w-full max-w-[430px] flex-col bg-surface md:h-auto md:max-h-[85dvh] md:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
              <h2 className="text-base font-bold text-text">Novo post</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="text-muted">
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
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
            </div>

            <div className="shrink-0 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:border-none md:pt-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!body.trim() || createPost.isPending}
                className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
              >
                {createPost.isPending ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
