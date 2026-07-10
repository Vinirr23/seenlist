"use client";

import { useRef, useState } from "react";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { hapticTick } from "@/lib/haptics";
import { useCommentImageUpload } from "@/lib/queries/comment-image-upload";

export interface CommentComposerProps {
  initialBody?: string;
  initialSpoiler?: boolean;
  initialImageUrl?: string | null;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (body: string, containsSpoiler: boolean, imageUrl: string | null) => void;
  onCancel?: () => void;
  isPending?: boolean;
}

/**
 * TASK-048 — mesmo componente pra "novo comentário", "responder" e
 * "editar" — só muda o texto inicial e o rótulo do botão, quem chama
 * decide (CommentThread passa `initialBody` quando é edição).
 *
 * TASK-065 — anexo de imagem/GIF. Um GIF é só um arquivo de imagem
 * animado (`image/gif`), então o mesmo seletor de arquivo cobre os
 * dois — não precisa de um botão "GIF" separado nem de busca
 * integrada (isso exigiria uma API de terceiro tipo Tenor/Giphy,
 * fora do escopo aqui). Upload acontece ao enviar o comentário, não
 * ao escolher o arquivo — evita subir imagem pra Storage se a pessoa
 * desistir do comentário depois.
 */
export function CommentComposer({
  initialBody = "",
  initialSpoiler = false,
  initialImageUrl = null,
  placeholder = "Escreva um comentário...",
  submitLabel = "Publicar",
  onSubmit,
  onCancel,
  isPending,
}: CommentComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [containsSpoiler, setContainsSpoiler] = useState(initialSpoiler);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, pending: uploadPending, error: uploadError, clearError } = useCommentImageUpload();

  const busy = Boolean(isPending) || uploadPending;

  function handlePickImage() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo depois de remover
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
    const trimmed = body.trim();
    if (!trimmed && !imageFile && !imagePreviewUrl) return;
    hapticTick();

    let imageUrl = imageFile ? null : imagePreviewUrl; // já tinha imagem (edição) e não trocou
    if (imageFile) {
      imageUrl = await upload(imageFile);
      if (!imageUrl) return; // upload falhou — useCommentImageUpload já guardou o erro pra mostrar
    }

    onSubmit(trimmed, containsSpoiler, imageUrl);
    if (!initialBody && !initialImageUrl) {
      setBody("");
      setContainsSpoiler(false);
      setImageFile(null);
      setImagePreviewUrl(null);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

      {imagePreviewUrl && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:) ou imagem já hospedada no Storage, sem domínio fixo */}
          <img src={imagePreviewUrl} alt="" className="max-h-40 rounded-lg border border-border object-cover" />
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

      {uploadError && <p className="text-xs text-danger">{uploadError}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={containsSpoiler}
              onChange={(e) => setContainsSpoiler(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            Contém spoiler
          </label>
          <button
            type="button"
            onClick={handlePickImage}
            aria-label="Anexar imagem ou GIF"
            className="flex items-center gap-1 text-xs text-muted hover:text-text"
          >
            <ImageIcon className="h-4 w-4" strokeWidth={2} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs font-medium text-muted">
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={(!body.trim() && !imagePreviewUrl) || busy}
            onClick={handleSubmit}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            {uploadPending ? "Enviando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
