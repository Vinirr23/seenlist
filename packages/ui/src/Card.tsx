import { type HTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
