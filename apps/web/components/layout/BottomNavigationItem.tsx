import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@seenlist/utils";

export interface BottomNavigationItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

export function BottomNavigationItem({
  href,
  label,
  icon: Icon,
  active = false,
}: BottomNavigationItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
    >
      <Icon
        className={cn("h-5 w-5", active ? "text-primary" : "text-muted")}
        strokeWidth={active ? 2.4 : 2}
      />
      <span className={cn("text-[11px]", active ? "font-medium text-text" : "text-muted")}>
        {label}
      </span>
    </Link>
  );
}
