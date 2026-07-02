import { type HTMLAttributes } from "react";
import { cn } from "@seenlist/utils";

/**
 * Estrutura mínima — sem portal, sem overlay, sem foco/teclado. Só o
 * suficiente para existir e ser importado. O `open` é a única
 * "lógica" aqui porque, sem ele, não dá pra diferenciar de um Card.
 */
export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
}

export function Modal({ open = false, className, children, ...props }: ModalProps) {
  if (!open) return null;

  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
