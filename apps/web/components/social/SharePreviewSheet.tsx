"use client";

import { useState } from "react";
import { X, Share2, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/lib/toast/ToastProvider";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social" — item 3 do pedido:
 * "ao tocar no botão de compartilhamento de uma avaliação, quero uma
 * interface de pré-visualização dentro do SeenList"). Mostra o card
 * visual que será compartilhado (a mesma imagem gerada pelo
 * `opengraph-image.tsx` da rota, via `imageUrl`) com botão de
 * compartilhar (nativo, com fallback pra copiar link) e cancelar.
 *
 * Reaproveita o padrão bespoke já usado em `ProfileAppPromoModal.tsx`
 * (overlay fixo + card central, sem extrair um primitivo novo de
 * modal — não existe um no projeto, criar um agora seria abstração
 * nova sem necessidade comprovada pra uma única tela).
 *
 * Usado tanto por reviews compartilhadas diretamente (`ReviewCard.tsx`)
 * quanto por reviews publicadas no Feed (`PostCard.tsx`, só quando
 * `post.type === "review"`) — mesmo componente pros dois, por pedido
 * explícito do usuário ("reutilizar o componente ou gerador visual
 * sempre que possível").
 */
export function SharePreviewSheet({
  imageUrl,
  shareUrl,
  onClose,
}: {
  imageUrl: string;
  shareUrl: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleNativeShare() {
    try {
      await navigator.share({ url: shareUrl });
      onClose();
    } catch {
      // usuário cancelou o menu nativo — não é erro, não precisa de toast.
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t("social.linkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[SharePreviewSheet] Falha ao copiar link", error);
      toast.error(t("social.linkCopyError"));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text">{t("social.sharePreviewTitle")}</p>
          <button type="button" onClick={onClose} aria-label={t("social.close")} className="text-muted">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada dinamicamente pela rota (`opengraph-image.tsx`), sem domínio fixo pra usar `next/image`. */}
          <img src={imageUrl} alt="" className="aspect-[1200/630] w-full object-cover" />
        </div>

        <div className="mt-4 flex items-center gap-2">
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-background"
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
              {t("social.share")}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyLink}
            className={`flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-text ${canNativeShare ? "" : "flex-1"}`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" strokeWidth={2} /> : null}
            {t("social.copyLink")}
          </button>
        </div>

        <button type="button" onClick={onClose} className="mt-2 w-full text-center text-xs font-medium text-muted">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
