import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useTranslation();
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
    >
      {/*
        * A PEDIDO — a cápsula que desliza (renderizada em
        * `BottomNavigation.tsx`, por trás de todos os itens) passou
        * a ser o ÚNICO indicador de aba ativa. O círculo individual
        * que cada ícone tinha (`bg-primary/15` só nele) foi removido
        * — os dois juntos ficariam redundantes, dois destaques
        * dizendo a mesma coisa. `z-10` no link garante que o ícone
        * fique por CIMA da cápsula (que não tem z-index próprio),
        * não escondido atrás dela.
        */}
      <span className="relative flex h-9 w-9 items-center justify-center">
        <Icon
          className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted")}
          strokeWidth={active ? 2.4 : 2}
        />
        {badge && (
          <span
            aria-label={t("nav.unreadNotifications")}
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface"
          />
        )}
      </span>
      <span className={cn("text-[10px]", active ? "font-semibold text-primary" : "text-muted")}>
        {label}
      </span>
    </Link>
  );
}
