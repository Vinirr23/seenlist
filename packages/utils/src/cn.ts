import clsx, { type ClassValue } from "clsx";

/** Combina classes condicionalmente. Usado pelos componentes de packages/ui. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
