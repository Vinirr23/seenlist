"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewTextComposerProps {
  myRating: number;
  initialText?: string | null;
  initialSpoiler?: boolean;
  onSubmit: (reviewText: string | null, containsSpoiler: boolean, shareToFeed: boolean) => void;
  isPending?: boolean;
  /** TASK-078 — só mostra "Publicar no Feed" quando a tela sabe pra qual título isso é. */
  canShareToFeed?: boolean;
}

/**
 * A PEDIDO — a parte de TEXTO do que antes era `ReviewComposer`
 * inteiro, agora vivendo dentro da tela de Comentários (a nota
 * continua na aba Sobre, em `ReviewComposer.tsx` simplificado). Só
 * aparece pra quem já deu uma nota (`myRating > 0`) — não faz
 * sentido escrever uma review sem ter avaliado primeiro.
 */
export function ReviewTextComposer({ myRating, initialText, initialSpoiler = false, onSubmit, isPending, canShareToFeed = false }: ReviewTextComposerProps) {
  const [text, setText] = useState(initialText ?? "");
  const [containsSpoiler, setContainsSpoiler] = useState(initialSpoiler);
  const [shareToFeed, setShareToFeed] = useState(false);
  const { t } = useTranslation();

  if (myRating === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("social.reviewPlaceholder")}
        rows={3}
        maxLength={4000}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />
      <div className="flex items-center justify-between">
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
          disabled={isPending}
          onClick={() => onSubmit(text.trim() || null, containsSpoiler, shareToFeed)}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          {t("social.saveReview")}
        </button>
      </div>
      {canShareToFeed && (
        <label className="flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={shareToFeed}
            onChange={(e) => setShareToFeed(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          {t("social.shareToFeed")}
        </label>
      )}
    </div>
  );
}
