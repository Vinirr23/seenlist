"use client";

import { useEffect, useState } from "react";
import { X, Smartphone, Bell, Zap, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** Dispensa temporária (fechou no X) — só nesta sessão. */
const DISMISS_SESSION_KEY = "seenlist:android-promo-dismissed";
/** Dispensa permanente — só pra quem clicou em baixar. */
const INSTALLED_KEY = "seenlist:android-promo-clicked-install";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";

/**
 * A PEDIDO — substitui o antigo `BetaPromoBanner` (removido antes
 * nesta sessão): aquele convidava pra fase fechada de teste; este
 * anuncia que o app já está disponível pra valer na Play Store.
 * Mesma estrutura visual de card central, adaptada — sem "beta" em
 * lugar nenhum, com link real pra Play Store.
 *
 * CORREÇÃO (a pedido — "aparece só uma vez e nunca mais") — usava
 * `localStorage`, que é permanente: quem dispensasse UMA vez nunca
 * mais veria o card, em nenhuma sessão, pra sempre. Trocado por
 * `sessionStorage` (mesmo comportamento do antigo banner de beta):
 * dispensar vale só pra sessão atual, e o card volta na próxima
 * visita.
 *
 * Quem CLICA em baixar continua com a dispensa permanente
 * (`localStorage`) — essa pessoa já foi pra Play Store, não faz
 * sentido continuar oferecendo. São dois casos diferentes que antes
 * eram tratados igual.
 */
export function AndroidAppPromoBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    /*
     * CORREÇÃO (a pedido, decidido com dado real do painel) — o modal
     * aparecia pra TODO MUNDO, inclusive quem está em iPhone ou
     * computador, que não tem como instalar app de Android nenhum.
     * Pra essas pessoas era interrupção pura, sem ação possível — e
     * gastava a única chance de convencer alguém a instalar.
     *
     * O porquê disso importar tanto: a retenção D7 de quem tem o app
     * é 36%, contra 4% de quem só usa o site. Nove vezes. Mostrar
     * este convite pra quem PODE agir é, hoje, a alavanca mais forte
     * que o produto tem — e mostrar pra quem não pode só queima
     * paciência.
     */
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) return;

    const clickedInstall = localStorage.getItem(INSTALLED_KEY) === "1";
    const dismissedThisSession = sessionStorage.getItem(DISMISS_SESSION_KEY) === "1";
    if (!clickedInstall && !dismissedThisSession) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_SESSION_KEY, "1");
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 transition-opacity duration-200",
        mounted ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl border border-primary/30 bg-surface p-6 shadow-[0_0_60px_-12px_rgba(232,163,61,0.4)] transition-all duration-200 ease-out",
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        )}
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("social.close")}
          className="absolute right-4 top-4 text-muted"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-background">
            <Smartphone className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-semibold text-text">seenlist</span>
        </div>

        <h2 className="text-2xl font-extrabold leading-tight text-text">
          {t("androidPromo.titleLine1")}
          <br />
          <span className="text-primary">{t("androidPromo.titleLine2")}</span>
        </h2>
        <p className="mt-2 text-sm text-muted">{t("androidPromo.subtitle")}</p>

        {/*
          * O aviso de episódio novo saiu de um ícone pequeno no meio
          * e virou o destaque: é o benefício que só o app entrega, e
          * a explicação mais provável pra diferença de retenção
          * (36% com app vs 4% sem). Os outros dois viraram linha
          * secundária — continuam verdade, mas não são o motivo de
          * alguém instalar.
          */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          <div>
            <p className="text-sm font-bold text-text">{t("androidPromo.featureNotifications")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t("androidPromo.featureNotificationsDetail")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
            {t("androidPromo.featureFast")}
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
            {t("androidPromo.featureSync")}
          </span>
        </div>

        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => localStorage.setItem(INSTALLED_KEY, "1")}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-extrabold uppercase tracking-wide text-background transition-transform active:scale-[0.98]"
        >
          {t("androidPromo.cta")}
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
        </a>
      </div>
    </div>
  );
}
