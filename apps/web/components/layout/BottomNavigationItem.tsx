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
      className="flex flex-1 flex-col items-center justify-center gap-1 py-3.5"
    >
      <Icon
        className={cn("h-6 w-6", active ? "text-text" : "text-muted")}
        strokeWidth={active ? 2.4 : 2}
      />
      <span className={cn("text-[10px]", active ? "font-semibold text-text" : "text-muted")}>
        {label}
      </span>
    </Link>
  );
}
