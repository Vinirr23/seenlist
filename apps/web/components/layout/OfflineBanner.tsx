"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * Fica no topo do fluxo normal da página (não `fixed`) — de
 * propósito: quase toda tela do app tem seu próprio cabeçalho
 * (botão de voltar + título) logo no topo; um banner `fixed`
 * cobriria esse cabeçalho por cima. Como banner "empurra" o
 * conteúdo pra baixo, sem sobrepor nada, e some sozinho assim que o
 * `online` dispara de novo. Mesma linguagem visual do aviso de
 * navegador interno (`InAppBrowserWarning.tsx`): cor de aviso
 * (âmbar), não de erro (vermelho) — ficar offline não é uma falha
 * do app, é um estado esperado que qualquer um pode encontrar.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-warning/40 bg-warning/15 px-4 py-2 text-center backdrop-blur-sm"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
      <p className="text-xs font-medium text-text">{t("offline.banner")}</p>
    </div>
  );
}
