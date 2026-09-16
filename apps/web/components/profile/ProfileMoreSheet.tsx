"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Share2, Settings, HelpCircle, Check, X } from "lucide-react";
import { useToast } from "@/lib/toast/ToastProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useDialogAnimation } from "@/lib/useDialogAnimation";
import { cn } from "@seenlist/utils";

/**
 * A PEDIDO (2026-09-15 — "do lado direito, implementa um botão (...)
 * e nele um sheet com 'editar, compartilhar, configurações e ajuda'
 * (editar, compartilhar, configurações são os que já existem e vão
 * ficar dentro desse sheet)") — os 3 primeiros eram botões soltos no
 * `ProfileHeader.tsx` (ícone de lápis + `ShareProfileButton` +
 * ícone de engrenagem, um do lado do outro, em cima da capa); viraram
 * linhas de UM sheet só, atrás do "...". "Ajuda" é item novo — aponta
 * pra `/profile/settings/feedback`, o único canal de suporte que já
 * existe no app (não existe uma central de ajuda separada).
 *
 * Mesmo formato visual e mesma animação de
 * `SeriesQuickActionsSheet.tsx` (`useDialogAnimation`, vidro `dark`
 * deslizando de baixo).
 *
 * REMOVIDO (2026-09-16, a pedido — "remove 'editar' do sheet (...)")
 * — o item "Editar perfil" (link `/profile/edit`) saiu daqui porque
 * virou um botão direto no cabeçalho (ver `ProfileHeader.tsx`, no
 * lugar de onde ficava o "@username"), sem precisar abrir este sheet.
 */
export function ProfileMoreSheet({ username, onClose }: { username?: string | null; onClose: () => void }) {
  const { mounted, handleClose } = useDialogAnimation(onClose);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShare() {
    if (!username) return;
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("social.linkCopied"));
      setTimeout(handleClose, 600);
    } catch (error) {
      console.error("[profile] Falha ao copiar link do perfil", error);
      toast.error(t("social.linkCopyError"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={cn("absolute inset-0 bg-black/60 transition-opacity duration-200", mounted ? "opacity-100" : "opacity-0")}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          "relative w-full max-w-[430px] rounded-t-2xl border-t border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-[18px] backdrop-saturate-[180%] transition-transform duration-200 ease-out",
          mounted ? "translate-y-0" : "translate-y-full"
        )}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)",
        }}
      >
        <button
          type="button"
          onClick={handleShare}
          disabled={!username}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4 text-success" strokeWidth={2} /> : <Share2 className="h-4 w-4" strokeWidth={2} />}
          {t("social.shareProfile")}
        </button>

        <Link
          href="/profile/settings"
          onClick={handleClose}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
        >
          <Settings className="h-4 w-4" strokeWidth={2} />
          {t("settings.title")}
        </Link>

        <Link
          href="/profile/settings/feedback"
          onClick={handleClose}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text hover:bg-background"
        >
          <HelpCircle className="h-4 w-4" strokeWidth={2} />
          {t("profile.help")}
        </Link>

        <button
          type="button"
          onClick={handleClose}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm text-muted"
        >
          <X className="h-4 w-4" strokeWidth={2} />
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
