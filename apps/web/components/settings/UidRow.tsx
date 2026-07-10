"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@seenlist/utils";

/**
 * TASK-030, item 3 — "somente leitura... botão de copiar ao lado".
 * Não reaproveita `SettingsRow` porque o layout muda de "linha
 * clicável inteira" pra "texto + botão específico" — o UID em si não
 * deveria disparar nenhuma navegação/ação ao tocar na linha, só o
 * botão explícito de copiar.
 */
export function UidRow({ uid, last }: { uid: string; last?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[settings] Falha ao copiar UID", error);
    }
  }

  return (
    <div className={cn("flex items-center justify-between px-3 py-3 text-sm", !last && "border-b border-border")}>
      <span className="text-text">UID</span>
      <span className="flex items-center gap-2">
        <span className="max-w-[120px] truncate text-xs text-muted">{uid}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar UID"
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-text"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-success" strokeWidth={2} />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              Copiar
            </>
          )}
        </button>
      </span>
    </div>
  );
}
