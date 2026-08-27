"use client";

import { useRef, useState } from "react";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { hapticTick } from "@/lib/haptics";
import { useCommentImageUpload } from "@/lib/queries/comment-image-upload";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

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
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  isPending,
}: CommentComposerProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("social.commentPlaceholder");
  const resolvedSubmitLabel = submitLabel ?? t("social.publish");
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
        placeholder={resolvedPlaceholder}
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

      {imagePreviewUrl && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob:) ou imagem já hospedada no Storage, sem domínio fixo */}
          <img src={imagePreviewUrl} alt="" className="max-h-40 rounded-lg border border-border object-cover" />
          {/* "Vidro" (redesign âmbar/vidro, 2026-08-26) — mesmo padrão de botão-círculo flutuante sobre imagem do GLASS_ICON_BTN (ProfileHeader.tsx/SeriesHeader.tsx), versão mini. */}
          <button
            type="button"
            onClick={handleRemoveImage}
            aria-label={t("social.removeImage")}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-text shadow-md shadow-black/25 backdrop-blur-md backdrop-saturate-150"
            style={{
              background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
            }}
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
            {t("social.containsSpoiler")}
          </label>
          <button
            type="button"
            onClick={handlePickImage}
            aria-label={t("social.attachImage")}
            className="flex items-center gap-1 text-xs text-muted hover:text-text"
          >
            <ImageIcon className="h-4 w-4" strokeWidth={2} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs font-medium text-muted">
              {t("common.cancel")}
            </button>
          )}
          <button
            type="button"
            disabled={(!body.trim() && !imagePreviewUrl) || busy}
            onClick={handleSubmit}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            {uploadPending ? t("social.sending") : resolvedSubmitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
