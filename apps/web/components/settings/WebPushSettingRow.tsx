"use client";

import { useEffect, useState } from "react";
import {
  isWebPushSupported,
  getPermissionState,
  hasActiveSubscription,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "@/lib/push/webPush";

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
      <p className="text-sm font-semibold text-text">Avisos neste navegador</p>

      {state === "unsupported" && (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {isIos
            ? "No iPhone, adicione o SeenList à tela de início (botão de compartilhar → Adicionar à Tela de Início) para poder receber avisos."
            : "Este navegador não suporta notificações."}
        </p>
      )}

      {state === "denied" && (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Você bloqueou as notificações deste site. Para reativar, mude a permissão nas configurações do navegador — não
          conseguimos fazer isso por aqui.
        </p>
      )}

      {(state === "active" || state === "inactive") && (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {state === "active"
              ? "Você recebe aviso aqui quando sai episódio novo das séries que acompanha."
              : "Ative para saber na hora quando sair episódio novo das suas séries."}
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
            {busy ? "Aguarde..." : state === "active" ? "Desativar" : "Ativar avisos"}
          </button>
        </>
      )}
    </div>
  );
}
