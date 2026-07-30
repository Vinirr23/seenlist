"use client";

import { useEffect, useState } from "react";

/**
 * Achado real de auditoria — o app não tinha NENHUM tratamento pra
 * "sem internet": uma mutação falhando por falta de rede aparecia
 * como um erro genérico igual a qualquer outro (ex.: "Não foi
 * possível salvar agora"), sem deixar claro que o problema era a
 * conexão, não o servidor. `navigator.onLine` não é 100% confiável
 * sozinho (alguns navegadores reportam `true` mesmo sem internet de
 * verdade, só checam se tem uma interface de rede ativa) — mas
 * combinado com os eventos `online`/`offline` (que disparam de
 * verdade quando o navegador detecta a mudança), é o sinal padrão
 * usado pela maioria dos apps web pra isso, sem precisar fazer
 * ping em nenhum servidor.
 */
export function useOnlineStatus(): boolean {
  // Assume online no primeiro render (inclusive no server, onde
  // `navigator` não existe) — evita divergência de hidratação.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
