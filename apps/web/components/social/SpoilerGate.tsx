"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-048 — "ocultação de spoilers: mostrar aviso; revelar somente
 * quando o usuário tocar". Um componente só, reutilizado por
 * comentário E review — não sabe nada sobre o conteúdo que esconde,
 * só recebe `hidden` (decidido por quem chama: `containsSpoiler`
 * manual, OU `useSpoilerProtection` automático por progresso pra
 * comentário de episódio) e o `children` a revelar.
 *
 * CORREÇÃO (bug real, reportado — "comentário aparece como spoiler
 * mas não é") — `reason` diferencia os dois motivos de ocultar na
 * MENSAGEM mostrada: `"spoiler"` (quem escreveu marcou de propósito)
 * vs `"unwatched"` (só está escondido porque QUEM VÊ ainda não
 * assistiu esse episódio — o comentário pode não ter spoiler nenhum
 * de verdade). Antes os dois casos diziam "Contém spoiler", mesmo
 * quando o motivo real era só progresso, não a marcação do autor.
 */
export function SpoilerGate({
  hidden,
  reason = "spoiler",
  children,
}: {
  hidden: boolean;
  reason?: "spoiler" | "unwatched";
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
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
      {t(reason === "unwatched" ? "social.spoilerGateUnwatched" : "social.spoilerGate")}
    </button>
  );
}
