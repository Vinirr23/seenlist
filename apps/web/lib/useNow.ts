import { useEffect, useState } from "react";

/**
 * A PEDIDO — "Feed mais vivo", item 3: "há 2 min" precisa virar "há
 * 3 min" sozinho, sem a pessoa fazer nada. Um componente só
 * re-renderiza quando algum estado dele muda — como "quanto tempo
 * passou" não é um dado que vem de lugar nenhum (é calculado na hora
 * de renderizar), sem isso o texto ficaria congelado no valor de
 * quando a página carregou. Este hook só força um re-render a cada
 * `intervalMs` — quem usa recalcula o texto relativo nesse momento.
 *
 * De propósito, UM hook por componente que precisa (não um timer
 * central compartilhado): mais simples e isolado — muda só o
 * componente que já usa isso, sem precisar alterar a assinatura de
 * nada que já existe.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
