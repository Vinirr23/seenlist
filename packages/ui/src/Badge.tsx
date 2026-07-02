import { type HTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {}

export function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(className)} {...props}>
      {children}
    </span>
  );
}
