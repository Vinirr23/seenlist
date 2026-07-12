"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { useToast } from "@/lib/toast/ToastProvider";

/**
 * TASK-079 — o Google bloqueia login do Google (erro
 * "disallowed_useragent") dentro de navegadores embutidos de outros
 * apps (Instagram, Facebook, TikTok, etc.) — política de segurança
 * do próprio Google desde 2021, não tem como contornar a partir do
 * SeenList. O que dá pra fazer é avisar a pessoa e ajudar ela a
 * sair desse navegador embutido pro navegador de verdade do
 * aparelho, onde o login funciona normalmente.
 *
 * Detecção por `navigator.userAgent` — cada um desses apps deixa uma
 * marca própria no user agent quando abre um link por dentro deles.
 * Roda só no client (`useEffect`), pra não divergir entre o HTML do
 * servidor e o do navegador.
 */
const IN_APP_BROWSER_PATTERNS = [
  { name: "Instagram", pattern: /Instagram/i },
  { name: "Facebook", pattern: /FBAN|FBAV|FB_IAB/i },
  { name: "Messenger", pattern: /MessengerForiOS/i },
  { name: "TikTok", pattern: /musical_ly|TikTok/i },
  { name: "Line", pattern: /\bLine\//i },
  { name: "WeChat", pattern: /MicroMessenger/i },
  { name: "Twitter", pattern: /Twitter/i },
];

export function InAppBrowserWarning() {
  const [appName, setAppName] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const ua = navigator.userAgent;
    const match = IN_APP_BROWSER_PATTERNS.find((entry) => entry.pattern.test(ua));
    if (match) setAppName(match.name);
  }, []);

  if (!appName) return null;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado — cola no seu navegador");
    } catch {
      toast.error("Não foi possível copiar. Copia o link da barra de endereço manualmente.");
    }
  }

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-text">
          Você está no navegador interno do {appName}. O login com Google não funciona aqui — abre esta página no
          navegador do seu aparelho (Chrome, Safari...) pra conseguir entrar.
        </p>
        <button
          type="button"
          onClick={handleCopyLink}
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary"
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
          Copiar link da página
        </button>
      </div>
    </div>
  );
}
