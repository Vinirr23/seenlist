import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";

/**
 * ATUALIZAÇÃO OTA AUTOMÁTICA (a pedido, 2026-09-22 — "como faço para
 * TODOS os usuários receberem o update?").
 *
 * CAUSA RAIZ do problema original: o app nunca chamava NENHUMA API de
 * `expo-updates` — só existia a config passiva em `app.json`
 * (`updates.url` + `runtimeVersion.policy: "appVersion"`). Isso
 * deixava o app 100% dependente do comportamento padrão do módulo
 * nativo (`checkAutomatically: ON_LOAD`, o padrão quando esse campo
 * não é definido): ele baixa o update em BACKGROUND ao abrir, mas só
 * APLICA no próximo cold start — quem abre o app e continua usando
 * (sem fechar de verdade) nunca via o update novo, mesmo já tendo
 * sido baixado. É por isso que o alcance de um `eas update` sempre
 * teve uma cauda longa de usuários demorando dias pra pegar.
 *
 * Este hook fecha essa lacuna: checa manualmente ao montar E toda vez
 * que o app volta pro primeiro plano (não só no cold start); se achar
 * update, baixa e recarrega IMEDIATAMENTE (`Updates.reloadAsync()`) —
 * sem esperar o usuário fechar e reabrir o app sozinho.
 *
 * Silencioso de propósito (sem toast/confirmação antes de recarregar)
 * — decisão explícita do usuário ao escolher esta opção em vez de
 * avisar e deixar o usuário decidir quando recarregar.
 *
 * NÃO resolve (limitação estrutural do `expo-updates`, não bug deste
 * hook): usuários com o BINÁRIO nativo numa versão anterior
 * (`runtimeVersion.policy: "appVersion"` — ver `app.json`) nunca
 * recebem NENHUM OTA, automático ou não — o runtime não bate, então o
 * servidor de updates nem oferece um update pra eles. Só atualizando
 * pela loja.
 */
export function useOtaUpdateCheck() {
  const checando = useRef(false);

  useEffect(() => {
    checarEAplicar();

    const subscription = AppState.addEventListener("change", (estado: AppStateStatus) => {
      if (estado === "active") checarEAplicar();
    });
    return () => subscription.remove();
  }, []);

  async function checarEAplicar() {
    /**
     * Expo Go e dev client não têm runtime de update de verdade — a
     * API lança erro nesses casos ("This app is running in Expo Go
     * / not embedded"). `Updates.isEmbeddedLaunch` só é `true` num
     * build real (standalone/EAS Build) — guard mais correto que
     * `__DEV__`, que também seria `false` rodando um dev client em
     * produção.
     */
    if (!Updates.isEmbeddedLaunch) return;
    if (checando.current) return;
    checando.current = true;

    try {
      const resultado = await Updates.checkForUpdateAsync();
      if (!resultado.isAvailable) return;

      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (erro) {
      // Sem rede, servidor de update fora do ar, etc. — falha
      // silenciosa de propósito: o app continua funcionando
      // normalmente com o JS que já tem carregado, e o
      // `checkAutomatically: ON_LOAD` nativo tenta de novo sozinho
      // no próximo cold start.
      console.warn("[ota-update] falha ao checar/aplicar update", erro);
    } finally {
      checando.current = false;
    }
  }
}
