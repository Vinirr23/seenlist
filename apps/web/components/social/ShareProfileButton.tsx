"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/lib/toast/ToastProvider";

export function ShareProfileButton({ username, iconOnly = false }: { username: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function handleShare() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[profile] Falha ao copiar link do perfil", error);
      toast.error("Não foi possível copiar o link.");
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleShare}
        aria-label="Compartilhar perfil"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform active:scale-90"
      >
        {copied ? <Check className="h-4 w-4 text-success" strokeWidth={2} /> : <Share2 className="h-4 w-4" strokeWidth={2} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text transition-transform active:scale-[0.96]"
    >
      {copied ? (
        <Check className="h-4 w-4 text-success" strokeWidth={2} />
      ) : (
        <Share2 className="h-4 w-4" strokeWidth={2} />
      )}
      Compartilhar perfil
    </button>
  );
}
