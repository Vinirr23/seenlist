"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Image as ImageIcon } from "lucide-react";
import { useCreatePost } from "@/lib/queries/posts";
import { usePostImageUpload } from "@/lib/queries/post-image-upload";
import { hapticTick } from "@/lib/haptics";
import { useHideBottomNav } from "@/lib/layout/bottomNavVisibility";

const MAX_LENGTH = 500;

/**
 * TASK-059 (fase 2) — criação de post. TASK-066 — segundo tipo de
 * post: imagem/GIF, com legenda opcional (o resto do pedido original
 * — poster/enquete/review/lista/spoiler — continua fase futura).
 *
 * Anexo de imagem/GIF: mesmo raciocínio do `CommentComposer`
 * (TASK-065) — um GIF é só um arquivo `image/gif`, o mesmo seletor
 * cobre os dois, sem precisar de busca integrada tipo Tenor/Giphy.
 * Upload só acontece ao publicar, não ao escolher o arquivo.
 */
export function CreatePostButton() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createPost = useCreatePost();
  const { upload, pending: uploadPending, error: uploadError, clearError } = usePostImageUpload();

  useHideBottomNav(open);

  // Trava o scroll do body por trás do modal — evita o "bounce" do
  // Safari iOS arrastar a página de fundo enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function resetForm() {
    setBody("");
    setImageFile(null);
    setImagePreviewUrl(null);
  }

  function handlePickImage() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clearError();
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreviewUrl(null);
  }

  async function handleSubmit() {
    if (!body.trim() && !imageFile) return;
    hapticTick();

    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await upload(imageFile);
      if (!imageUrl) return; // upload falhou — o erro já fica visível no modal
    }

    createPost.mutate(
      { body: body.trim(), imageUrl },
      {
        onSuccess: () => {
          resetForm();
          setOpen(false);
        },
      }
    );
  }

  const busy = createPost.isPending || uploadPending;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          hapticTick();
          setOpen(true);
        }}
        aria-label="Criar post"
        className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-background shadow-lg active:scale-95"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 md:items-center">
          <div className="flex h-[100dvh] w-full max-w-[430px] flex-col bg-surface md:h-auto md:max-h-[85dvh] md:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
              <h2 className="text-base font-bold text-text">Novo post</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                aria-label="Fechar"
                className="text-muted"
              >
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

              {imagePreviewUrl && (
                <div className="relative mt-2 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:), sem domínio fixo */}
                  <img
                    src={imagePreviewUrl}
                    alt=""
                    className="max-h-56 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    aria-label="Remover imagem"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-text"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              )}

              {uploadError && <p className="mt-2 text-xs text-danger">{uploadError}</p>}

              <button
                type="button"
                onClick={handlePickImage}
                className="mt-2 flex items-center gap-1.5 text-xs text-muted hover:text-text"
              >
                <ImageIcon className="h-4 w-4" strokeWidth={2} />
                {imagePreviewUrl ? "Trocar imagem" : "Anexar imagem ou GIF"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="shrink-0 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:border-none md:pt-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={(!body.trim() && !imageFile) || busy}
                className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
              >
                {uploadPending ? "Enviando imagem..." : createPost.isPending ? "Publicando..." : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
