import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import SpInAppUpdates, { IAUUpdateKind, type StartUpdateOptions, type StatusUpdateEvent } from "sp-react-native-in-app-updates";
import { supabase } from "@/lib/supabase";

/**
 * IN-APP UPDATE DO GOOGLE PLAY (a pedido, "vamos ativar o in-app
 * update do google play", 2026-09-16, antes de mandar esta versão pra
 * Play Store) — usa o Play Core por baixo (via
 * `sp-react-native-in-app-updates`, que tem plugin de config do Expo
 * — não precisa de código nativo escrito à mão, só rodar
 * `expo prebuild`/build de novo depois de instalar o pacote e somar
 * o plugin em `app.json`).
 *
 * SÓ ANDROID — a Play Store (e o Play Core) não existe no iOS; a
 * biblioteca tem um caminho pro App Store também (`iosStrategy`), mas
 * o pedido foi especificamente "in-app update do GOOGLE PLAY", então
 * o iOS fica de fora de propósito, sem checagem nenhuma (`Platform.OS
 * !== "android"` corta tudo antes de qualquer chamada nativa).
 *
 * DOIS TIPOS, confirmados com o usuário via pergunta explícita
 * (AskUserQuestion, "os dois: flexível por padrão, imediata quando eu
 * marcar"):
 *   - FLEXÍVEL (padrão) — baixa em segundo plano, app continua
 *     usável; só pede pra reiniciar/instalar quando o download
 *     termina.
 *   - IMEDIATA — tela cheia do próprio Play Core, trava o app até
 *     atualizar. Só liga quando `app_config.force_update_android`
 *     (Supabase, migration `20260916000000_app_config_force_update.
 *     sql`) estiver `true` — interruptor manual pro usuário virar
 *     quando publicar uma versão com bug crítico que precise forçar
 *     todo mundo a atualizar. Ver o comentário completo da migration
 *     pra como ligar/desligar.
 *
 * QUANDO CHECA, confirmado com o usuário via a mesma pergunta ("ao
 * abrir E toda vez que volta pro primeiro plano"): uma vez no mount
 * (cold start) e de novo toda vez que o `AppState` muda pra "active"
 * (a pessoa volta pro app depois de ter minimizado) — cobre quem
 * deixa o app aberto em segundo plano por dias sem nunca fechar de
 * verdade.
 *
 * `curVersion` vem de `Constants.expoConfig?.version` (o mesmo
 * `"version"` de `app.json`, bumpado a cada build de produção via
 * `autoIncrement` em `eas.json`) — não de `expo-application` (que
 * exigiria somar mais uma dependência nativa só pra isso; o valor do
 * `app.json` já é a fonte de verdade da versão publicada, por causa
 * do `autoIncrement`).
 */

const inAppUpdates = new SpInAppUpdates(__DEV__);

/** `InstallStatus.DOWNLOADED` do Play Core = 11 (conferido na doc oficial do Android — NÃO é 4, que é `INSTALLED`, outro estado). */
const ANDROID_INSTALL_STATUS_DOWNLOADED = 11;

async function isForceUpdateFlagged(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("app_config").select("force_update_android").eq("id", true).maybeSingle();
    if (error || !data) return false;
    return !!data.force_update_android;
  } catch {
    // Sem internet, tabela ainda não migrada, etc. — nunca bloqueia o
    // app por causa disso; só cai no caminho flexível (ou nem checa
    // update nenhum, ver `checkAndPromptUpdate`).
    return false;
  }
}

async function checkAndPromptUpdate() {
  if (Platform.OS !== "android") return;

  const curVersion = Constants.expoConfig?.version;
  if (!curVersion) return;

  try {
    const result = await inAppUpdates.checkNeedsUpdate({ curVersion });
    if (!result.shouldUpdate) return;

    const forceImmediate = await isForceUpdateFlagged();
    const updateType = forceImmediate ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE;

    if (updateType === IAUUpdateKind.FLEXIBLE) {
      // Só o caminho flexível precisa de listener — o imediato é uma
      // tela cheia do próprio Play Core que já cuida de instalar
      // sozinho, não devolve controle pro app até terminar.
      const onStatusUpdate = (status: StatusUpdateEvent) => {
        if (status.status === ANDROID_INSTALL_STATUS_DOWNLOADED) {
          inAppUpdates.installUpdate();
          inAppUpdates.removeStatusUpdateListener(onStatusUpdate);
        }
      };
      inAppUpdates.addStatusUpdateListener(onStatusUpdate);
    }

    const updateOptions: StartUpdateOptions = { updateType };
    await inAppUpdates.startUpdate(updateOptions);
  } catch (err) {
    // Nunca deixa uma falha de checagem (sem rede, Play Store
    // indisponível, etc.) derrubar o app — só desiste silenciosamente
    // desta rodada; a próxima abertura/retomada tenta de novo.
    if (__DEV__) {
      console.warn("[inAppUpdate] falha ao checar/iniciar atualização:", err);
    }
  }
}

/**
 * Chamado uma vez no layout raiz (`app/_layout.tsx`) — dispara a
 * checagem no mount e registra o listener de `AppState` pra checar de
 * novo a cada retomada. Sem retorno/estado: a UI da atualização é
 * toda nativa (Play Core), não tem nada pra este hook renderizar.
 */
export function useInAppUpdateCheck() {
  const checkedOnMount = useRef(false);

  useEffect(() => {
    if (!checkedOnMount.current) {
      checkedOnMount.current = true;
      checkAndPromptUpdate();
    }

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkAndPromptUpdate();
      }
    });

    return () => subscription.remove();
  }, []);
}
