"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

const DISMISS_KEY = "seenlist:beta-banner-dismissed";

/**
 * TASK-071 — banner flutuante convidando pra `/beta` (a landing page
 * de captação de e-mail), mostrado assim que a pessoa está logada no
 * app. Guardado em `sessionStorage` (não `localStorage`, de
 * propósito): some ao fechar, mas volta a aparecer na próxima vez
 * que a pessoa abrir o app de novo — "assim que a pessoa loga" pedia
 * isso, não "só uma vez pra sempre". Só existe no client (`useEffect`
 * pra checar o `sessionStorage`) — evita mismatch entre o HTML do
 * servidor e o do navegador.
 */
export function BetaPromoBanner() {
  const [dismissed, setDismissed] = useState(true); // começa escondido — só aparece depois de confirmar (no client) que não foi dispensado nesta sessão

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="w-full px-4 pt-3 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-surface px-3 py-2.5 shadow-[0_0_24px_-8px_rgba(232,163,61,0.35)]">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
        <p className="flex-1 text-xs leading-snug text-text">
          A beta do SeenList está chegando — <span className="font-semibold text-primary">convide seus amigos.</span>
        </p>
        <Link
          href="/beta"
          onClick={handleDismiss}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-background"
        >
          Ver
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar aviso"
          className="shrink-0 text-muted hover:text-text"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
