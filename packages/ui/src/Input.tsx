import { type InputHTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(className)} {...props} />;
}
