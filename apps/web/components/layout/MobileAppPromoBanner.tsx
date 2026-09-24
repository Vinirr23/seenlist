"use client";

import { useEffect, useState } from "react";
import { X, Smartphone, Bell, Zap, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * RENOMEADO de `AndroidAppPromoBanner.tsx` (2026-09-24, a pedido —
 * "estende agora" pro iOS, já que o app "SeenList: Séries e Filmes"
 * saiu de verdade na App Store nesta sessão, confirmado por instalação
 * de terceiro). Histórico de antes da renomeação:
 *
 * A PEDIDO — substitui o antigo `BetaPromoBanner` (removido antes
 * nesta sessão): aquele convidava pra fase fechada de teste; este
 * anuncia que o app já está disponível pra valer na Play Store.
 * Mesma estrutura visual de card central, adaptada — sem "beta" em
 * lugar nenhum, com link real pra Play Store.
 *
 * CORREÇÃO (a pedido — "aparece só uma vez e nunca mais") — usava
 * `localStorage` permanente, depois foi trocado pra `sessionStorage`
 * (achando que resolvia). Não resolveu: reportado com teste real —
 * fechar o navegador por completo e reabrir não trouxe o banner de
 * volta. Causa real: `sessionStorage` depende do navegador tratar
 * aquilo como uma sessão "nova" de verdade — recursos como
 * "continuar de onde parou" (Chrome e outros) podem preservar sessão
 * mesmo fechando aba/janela, então não é confiável pro que se
 * precisa aqui.
 *
 * Trocado pro MESMO padrão já usado em `WebPushPrompt.tsx`:
 * `localStorage` com PRAZO (não sessão do navegador, não permanente)
 * — dispensar vale por `DISMISS_DAYS`, independe de como o navegador
 * decide tratar "sessão".
 *
 * Quem CLICA em baixar continua com a dispensa permanente
 * (`INSTALLED_KEY`, sem prazo) — essa pessoa já foi pra loja, não faz
 * sentido continuar oferecendo.
 *
 * MUDANÇA NESTA REVISÃO (2026-09-24) — a detecção de plataforma virou
 * `isAndroid || isIOS` (antes só `isAndroid`, porque não existia pra
 * onde mandar usuário de iPhone). Loja/link/texto do CTA agora
 * dependem da plataforma detectada (`STORE_URL`/`ctaKey` por
 * `platform`). Chaves de armazenamento no `localStorage` também
 * mudaram de nome (`seenlist:android-promo-*` → `seenlist:app-promo-*`)
 * DE PROPÓSITO — reseta a dispensa/instalação de quem já tinha
 * interagido com a versão só-Android, o que é o comportamento certo
 * aqui (o banner agora é uma oferta diferente, com destino real pra
 * quem antes não tinha nenhum).
 */
const DISMISS_KEY = "seenlist:app-promo-dismissed-until";
const DISMISS_DAYS = 7;
const INSTALLED_KEY = "seenlist:app-promo-clicked-install";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";
const APP_STORE_URL = "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654";

type MobilePlatform = "android" | "ios" | null;

export function MobileAppPromoBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<MobilePlatform>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    /*
     * CORREÇÃO (a pedido, decidido com dado real do painel) — o modal
     * aparecia pra TODO MUNDO, inclusive quem está em computador, que
     * não tem como instalar app nenhum. Pra essas pessoas era
     * interrupção pura, sem ação possível — e gastava a única chance
     * de convencer alguém a instalar.
     *
     * O porquê disso importar tanto: a retenção D7 de quem tem o app
     * é 36%, contra 4% de quem só usa o site (dado medido só com o
     * app Android até aqui — ainda não há dado equivalente pro app
     * iOS, recém-publicado). Mostrar este convite pra quem PODE agir
     * é, hoje, a alavanca mais forte que o produto tem — e mostrar pra
     * quem não pode só queima paciência.
     */
    const userAgent = navigator.userAgent;
    const isAndroid = /android/i.test(userAgent);
    // Detecção padrão de iOS via user agent — inclui iPad que pede
    // versão desktop (reporta "MacIntel" na plataforma, mas com touch
    // habilitado), caso comum em iPad moderno.
    const isIOS = /iphone|ipad|ipod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const detectedPlatform: MobilePlatform = isAndroid ? "android" : isIOS ? "ios" : null;
    if (!detectedPlatform) return;

    const clickedInstall = localStorage.getItem(INSTALLED_KEY) === "1";
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const stillDismissed = dismissedUntil > Date.now();
    if (!clickedInstall && !stillDismissed) {
      setPlatform(detectedPlatform);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  if (!open || !platform) return null;

  const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const ctaLabel = platform === "ios" ? t("androidPromo.ctaIos") : t("androidPromo.cta");

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
          * (36% com app vs 4% sem, medido no Android). Os outros dois
          * viraram linha secundária — continuam verdade, mas não são
          * o motivo de alguém instalar.
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
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => localStorage.setItem(INSTALLED_KEY, "1")}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-extrabold uppercase tracking-wide text-background transition-transform active:scale-[0.98]"
        >
          {ctaLabel}
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
        </a>
      </div>
    </div>
  );
}
