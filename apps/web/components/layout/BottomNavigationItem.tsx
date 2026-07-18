import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@seenlist/utils";

export interface BottomNavigationItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** TASK-169 — bolinha de aviso (recomendações não lidas, por enquanto só usado na aba Perfil). */
  badge?: boolean;
}

export function BottomNavigationItem({
  href,
  label,
  icon: Icon,
  active = false,
  badge = false,
}: BottomNavigationItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-3.5"
    >
      <span className="relative">
        <Icon
          className={cn("h-6 w-6", active ? "text-text" : "text-muted")}
          strokeWidth={active ? 2.4 : 2}
        />
        {badge && (
          <span
            aria-label="Notificações não lidas"
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface"
          />
        )}
      </span>
      <span className={cn("text-[10px]", active ? "font-semibold text-text" : "text-muted")}>
        {label}
      </span>
    </Link>
  );
}
