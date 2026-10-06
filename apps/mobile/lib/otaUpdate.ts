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
 *
 * INVESTIGAÇÃO (2026-10-06, "não vi a mudança visual depois do
 * update") — este hook, o `eas.json`/`app.json` e o pipeline de
 * entrega do OTA em si foram todos auditados e confirmados corretos
 * (canal/branch/runtime batendo, `eas channel:view production`
 * limpo, e um publish de diagnóstico temporário provou, ao vivo no
 * aparelho, que o app baixa e aplica update novo normalmente). A
 * CAUSA RAIZ real não tinha nada a ver com OTA: a implementação dos
 * cards coloridos (`ActivityCard.tsx`) nunca tinha sido salva de
 * verdade no arquivo no disco do usuário (`git diff`/`git status`
 * confirmaram — só a correção de tamanho de pôster, de um commit
 * anterior, estava lá). Reaplicada e reconferida puxando o arquivo de
 * volta do disco antes de publicar de novo. Este hook nunca teve bug.
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
     * BUG REAL CORRIGIDO (2026-09-29, achado investigando "update não
     * chega mesmo fechando e abrindo várias vezes") — este guard usava
     * `Updates.isEmbeddedLaunch`, que parecia certo ("só builds de
     * verdade, nunca Expo Go") mas tem um significado bem diferente do
     * que o nome sugere: ele só é `true` no PRIMEIRO lançamento do app,
     * antes de qualquer update OTA já ter sido aplicado — assim que o
     * aparelho recebe o primeiro update, vira `false` PRA SEMPRE (até
     * um novo build nativo pela loja), mesmo sendo um build de produção
     * de verdade rodando normalmente. Resultado: este hook parava de
     * checar update novo pra sempre, bem no momento em que ele mais
     * precisava continuar funcionando — e é exatamente esse o estado
     * em que o app real do usuário está hoje. Confirmado ao vivo: um
     * texto de diagnóstico no Feed mostrou `embedded: false` no
     * aparelho de teste.
     *
     * `Updates.isEnabled` é o guard certo pra "isso é Expo Go/dev
     * client sem runtime de update" — é uma flag fixa de configuração
     * de build (true em qualquer build com updates habilitado, false
     * em Expo Go), não muda depois de aplicar um update.
     */
    if (!Updates.isEnabled) return;
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
