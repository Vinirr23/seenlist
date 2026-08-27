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
    // "Vidro" (redesign âmbar/vidro, 2026-08-26) — "toque mais leve" (mesmo critério de EmptyShelf.tsx/ViewModeToggle.tsx): mantém a borda tracejada (função visual de "aviso"), só troca o fundo opaco por vidro.
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-white/15 px-3 py-2 text-left text-xs text-muted backdrop-blur-[10px] transition-colors hover:border-primary/50 hover:text-text"
      style={{ background: "rgba(255,255,255,0.05)" }}
    >
      <EyeOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {t("social.spoilerGate")}
    </button>
  );
}
