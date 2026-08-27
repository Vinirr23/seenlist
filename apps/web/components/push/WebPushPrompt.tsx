"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  isWebPushSupported,
  getPermissionState,
  hasActiveSubscription,
  subscribeToWebPush,
} from "@/lib/push/webPush";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — convite pra ativar aviso de episódio novo no navegador.
 *
 * Por que existe (dado real): D7 de 36% com app vs 4% só site. O
 * aviso de episódio é a diferença mais provável, e 81% da base está
 * só no site. Este card leva esse benefício pra quem não tem (ou não
 * pode ter, no caso do iPhone) o app.
 *
 * REGRAS DE NÃO INCOMODAR, propositalmente conservadoras:
 * - Não aparece se o navegador não suporta (não adianta oferecer).
 * - Não aparece se já foi permitido ou já foi negado — pedir
 *   permissão de novo depois de um "não" é o padrão mais irritante
 *   da web, e o navegador nem mostra o pedido duas vezes.
 * - Dispensar vale por 7 dias (não pra sempre, não a cada sessão).
 * - NUNCA dispara o pedido do navegador sozinho: só depois de a
 *   pessoa tocar em "Ativar". Pedir permissão a frio, sem contexto,
 *   é o que faz a maioria negar — e negado é definitivo.
 */
const DISMISS_KEY = "seenlist:web-push-dismissed-until";
const DISMISS_DAYS = 7;

export function WebPushPrompt() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isWebPushSupported()) return;
      // "default" = ainda não decidiu. "granted"/"denied" já foram
      // decididos e não devem ser perguntados de novo.
      if (getPermissionState() !== "default") return;
      if (await hasActiveSubscription()) return;

      const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() < dismissedUntil) return;

      if (!cancelled) setVisible(true);
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    setVisible(false);
  }

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const result = await subscribeToWebPush();
    setBusy(false);

    if (result.ok) {
      setVisible(false);
      return;
    }
    if (result.reason === "denied") {
      // Negado é definitivo do lado do navegador — some e não insiste.
      setVisible(false);
      return;
    }
    setError(t("push.enableError"));
  }

  if (!visible) return null;

  return (
    // "Vidro" (toque leve — mantém o tom âmbar do aviso, ganha blur/saturação em vez de `bg-primary/5` chapado).
    <div
      className="mb-4 rounded-xl border border-primary/25 p-4 backdrop-blur-[14px] backdrop-saturate-[160%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10), transparent 60%), rgba(240,169,79,0.08)",
      }}
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text">{t("push.webPromptTitle")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{t("push.webPromptDescription")}</p>

          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
            >
              {busy ? t("push.enabling") : t("push.enableAlerts")}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-muted"
            >
              {t("social.notNow")}
            </button>
          </div>
        </div>

        <button type="button" onClick={handleDismiss} aria-label={t("social.close")} className="shrink-0 text-muted">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
