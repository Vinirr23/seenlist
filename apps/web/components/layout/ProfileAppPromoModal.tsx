"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Apple, GooglePlayIcon } from "@/components/landing/shared";

/**
 * A PEDIDO (2026-10-08, reportado — "quando alguém clica no link desse
 * banner [de compartilhar perfil] abre essa tela, mas não tem nada aí
 * tipo 'baixe o app'") — depois de corrigir a faixa fina ausente
 * (`MobileAppPromoBanner`, ver `app/u/[username]/page.tsx`), pedido
 * seguinte: além da faixa, um popup mais forte só na PRIMEIRA vez que
 * a página de perfil compartilhado abre — com mensagem + os dois
 * botões de loja, fecha com X e deixa navegar (decisão do usuário:
 * não bloqueia a tela).
 *
 * Reaproveita a MESMA chave de "já clicou instalar"
 * (`seenlist:app-promo-clicked-install`) que `MobileAppPromoBanner.tsx`
 * já usa — clicar numa loja aqui também esconde a faixa fina (e
 * vice-versa, clicar na faixa também esconde este popup em visitas
 * futuras): é o mesmo sinal de intenção real, não dois contadores
 * separados. O X só fecha ESTA visita (mesmo critério do X da faixa)
 * — recarregar a página mostra de novo, a não ser que a pessoa já
 * tenha clicado em alguma loja alguma vez.
 */
const INSTALLED_KEY = "seenlist:app-promo-clicked-install";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";
const APP_STORE_URL = "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654";

export function ProfileAppPromoModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const clickedInstall = localStorage.getItem(INSTALLED_KEY) === "1";
    if (!clickedInstall) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleDismiss() {
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  function handleStoreClick() {
    localStorage.setItem(INSTALLED_KEY, "1");
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 transition-opacity duration-200 sm:items-center ${mounted ? "opacity-100" : "opacity-0"}`}
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <button type="button" onClick={handleDismiss} aria-label={t("social.close")} className="text-muted">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <p className="text-center text-base font-semibold text-text">{t("social.profilePromoTitle")}</p>
        <p className="mt-1 text-center text-sm text-muted">{t("social.profilePromoSubtitle")}</p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStoreClick}
            aria-label="App Store"
            className="flex items-center justify-center rounded-full border border-primary/30 p-3"
          >
            <Apple className="h-6 w-6" />
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStoreClick}
            aria-label="Google Play"
            className="flex items-center justify-center rounded-full border border-primary/30 p-3"
          >
            <GooglePlayIcon className="h-6 w-6" />
          </a>
        </div>
      </div>
    </div>
  );
}
