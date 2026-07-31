import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/**
 * Equivalente nativo do `useOnlineStatus.ts` do web — lá usamos
 * `navigator.onLine` + eventos do browser (sem dependência nova,
 * mas o próprio browser já tem isso pronto); aqui não existe
 * equivalente nativo do RN sem uma lib — daí o `@react-native-
 * community/netinfo` (dependência nativa nova, por isso build
 * novo).
 *
 * `isConnected` sozinho não é suficiente — no Android em particular,
 * é comum estar conectado a um Wi-Fi sem internet de verdade (Wi-Fi
 * de hotel, roteador sem link, etc.). Por isso a checagem combina
 * `isConnected` (tem uma interface de rede ativa) com
 * `isInternetReachable !== false` (NetInfo já testou a internet de
 * verdade e não veio negativo — `null` significa "ainda não testou",
 * tratado como "provavelmente online" pra não piscar o aviso à toa
 * no instante entre abrir o app e a primeira checagem terminar).
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
