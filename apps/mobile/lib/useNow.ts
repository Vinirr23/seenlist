import { useEffect, useState } from "react";

/**
 * A PEDIDO — "Feed mais vivo", item 3. Porta fiel de
 * `apps/web/lib/useNow.ts`. Só força um re-render a cada
 * `intervalMs` — quem usa recalcula o texto relativo nesse momento.
 * Um hook por componente que precisa (não um timer central
 * compartilhado) — mais simples e isolado.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
