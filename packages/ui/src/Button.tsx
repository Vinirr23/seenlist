import { type ButtonHTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

/**
 * Estrutura mínima — sem variantes, sem tamanhos, sem estado de
 * loading. Só o suficiente para existir e ser importado. Lógica e
 * estilo entram numa próxima tarefa.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button className={cn(className)} {...props}>
      {children}
    </button>
  );
}
