import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@seenlist/utils";

export interface SettingsRowProps {
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  last?: boolean;
}

export function SettingsRow({ label, value, href, onClick, danger, last }: SettingsRowProps) {
  const className = cn(
    "flex w-full items-center justify-between px-3 py-3 text-left text-sm",
    !last && "border-b border-border",
    danger ? "text-danger" : "text-text"
  );

  const content = (
    <>
      <span>{label}</span>
      <span className="flex items-center gap-2 text-muted">
        {value && <span className="max-w-[160px] truncate text-xs">{value}</span>}
        {(href || onClick) && <ChevronRight className="h-4 w-4" strokeWidth={2} />}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  // Nem href nem onClick — linha só informativa (ex.: E-mail em Configurações → Conta), sem parecer clicável.
  return <div className={className}>{content}</div>;
}
