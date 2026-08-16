"use client";

import { useEffect, useState } from "react";
import {
  isWebPushSupported,
  getPermissionState,
  hasActiveSubscription,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "@/lib/push/webPush";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — controle permanente do aviso no navegador, nas
 * Configurações. Complementa o card da Home (`WebPushPrompt`): aquele
 * é o convite, este é onde quem dispensou pode ativar depois, e quem
 * ativou pode desligar.
 *
 * Estados possíveis, cada um com mensagem própria — porque as ações
 * de quem lê são completamente diferentes:
 * - não suportado: nada a fazer (e no iPhone tem instrução específica)
 * - bloqueado: só nas configurações do navegador, o site não pode reverter
 * - ativo / inativo: alternável aqui mesmo
 */
export function WebPushSettingRow() {
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "active" | "inactive">("loading");
  const [busy, setBusy] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    async function check() {
      setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

      if (!isWebPushSupported()) {
        setState("unsupported");
        return;
      }
      const permission = getPermissionState();
      if (permission === "denied") {
        setState("denied");
        return;
      }
      setState((await hasActiveSubscription()) ? "active" : "inactive");
    }
    check();
  }, []);

  async function handleToggle() {
    setBusy(true);
    if (state === "active") {
      const ok = await unsubscribeFromWebPush();
      if (ok) setState("inactive");
    } else {
      const result = await subscribeToWebPush();
      if (result.ok) setState("active");
      else if (result.reason === "denied") setState("denied");
    }
    setBusy(false);
  }

  if (state === "loading") return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text">{t("push.settingsTitle")}</p>

      {state === "unsupported" && (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {isIos ? t("push.iosInstructions") : t("push.unsupportedBrowser")}
        </p>
      )}

      {state === "denied" && <p className="mt-1 text-xs leading-relaxed text-muted">{t("push.deniedMessage")}</p>}

      {(state === "active" || state === "inactive") && (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {state === "active" ? t("push.activeMessage") : t("push.inactiveMessage")}
          </p>
          <button
            type="button"
            onClick={handleToggle}
            disabled={busy}
            className={
              state === "active"
                ? "mt-3 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted disabled:opacity-50"
                : "mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
            }
          >
            {busy ? t("push.waiting") : state === "active" ? t("push.disable") : t("push.enableAlerts")}
          </button>
        </>
      )}
    </div>
  );
}
