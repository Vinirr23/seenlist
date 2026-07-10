"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";

/**
 * TASK-048 — "ocultação de spoilers: mostrar aviso; revelar somente
 * quando o usuário tocar". Um componente só, reutilizado por
 * comentário E review — não sabe nada sobre o conteúdo que esconde,
 * só recebe `hidden` (decidido por quem chama: `containsSpoiler`
 * manual, OU `useSpoilerProtection` automático por progresso pra
 * comentário de episódio) e o `children` a revelar.
 */
export function SpoilerGate({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (!hidden || revealed) {
    return <>{children}</>;
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-left text-xs text-muted transition-colors hover:border-primary/50 hover:text-text"
    >
      <EyeOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      Contém spoiler — toque para revelar
    </button>
  );
}
