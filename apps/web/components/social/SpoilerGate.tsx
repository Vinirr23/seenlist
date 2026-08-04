"use client";

import { useState } from "react";
import { EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-048 — "ocultação de spoilers: mostrar aviso; revelar somente
 * quando o usuário tocar". Um componente só, reutilizado por
 * comentário E review — só recebe `hidden` (decidido por quem chama,
 * a partir do `containsSpoiler` manual de cada item) e o `children`
 * a revelar.
 *
 * A proteção automática por progresso (esconder tudo se a pessoa
 * ainda não assistiu o episódio) NÃO passa mais por aqui — virou um
 * aviso único, antes de entrar na tela de Comentários, em
 * `EpisodeDetailView.tsx`. Aqui só sobrou o `containsSpoiler` real,
 * marcado por quem escreveu.
 */
export function SpoilerGate({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
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
      {t("social.spoilerGate")}
    </button>
  );
}
