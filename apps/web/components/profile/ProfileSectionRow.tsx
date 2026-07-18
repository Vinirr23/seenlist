import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export interface ProfileSectionRowProps {
  icon: LucideIcon;
  label: string;
  count: number | undefined;
  href: string;
}

/**
 * TASK-029 — não reaproveitei `SettingsRow` (existe em
 * components/settings/) porque ali o padrão visual é outro (lista
 * simples, sem ícone, sem contador em destaque) — o mockup desta
 * tarefa pede ícone + número grande à direita, uma linguagem visual
 * diferente. Reaproveito sim `ChevronRight`, o mesmo ícone de
 * navegação usado em toda a Settings.
 */
export function ProfileSectionRow({ icon: Icon, label, count, href }: ProfileSectionRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors active:bg-background"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12">
          <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
        </span>
        <span className="text-sm font-medium text-text">{label}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-muted">{count === undefined ? "…" : count}</span>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
      </span>
    </Link>
  );
}
