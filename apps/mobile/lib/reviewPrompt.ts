import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

/**
 * Gatilho do prompt nativo de avaliação (App Store/Play Store) —
 * 2026-09-24, a pedido ("melhorar o ASO das duas lojas" → decisão do
 * usuário via AskUserQuestion: disparar "depois de marcar N
 * episódios/filmes assistidos", não no Week Review nem ao completar
 * uma temporada).
 *
 * `expo-store-review` já estava instalado no `package.json` desde
 * antes, mas nunca tinha sido usado em nenhum lugar do código — este
 * módulo é o primeiro uso real dele.
 *
 * Contador simples em `AsyncStorage`: toda vez que uma marcação de
 * "assistido" acontece de verdade (nunca ao desmarcar — ver os
 * pontos de chamada em `seriesDetails.ts`), soma 1. Ao bater o limiar
 * (10), dispara o prompt nativo UMA ÚNICA VEZ pra sempre (o próprio
 * sistema operacional já limita quantas vezes um app pode pedir por
 * ano, mas não custa nada também não incomodar de novo depois da
 * primeira vez — `hasRequested` trava isso permanentemente).
 *
 * `StoreReview.requestReview()` não garante que o diálogo REALMENTE
 * apareça (a Apple/Google podem decidir não mostrar, por limite deles
 * já ter sido atingido) — é assim que a API funciona por design, não
 * um bug daqui.
 */
const COUNT_KEY = "seenlist:reviewPrompt:watchedCount";
const REQUESTED_KEY = "seenlist:reviewPrompt:hasRequested";
const THRESHOLD = 10;

async function hasAlreadyRequested(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(REQUESTED_KEY)) === "1";
  } catch {
    // Leitura falhou (armazenamento indisponível) — trata como "ainda
    // não pediu", na pior das hipóteses tenta nudar de novo depois.
    return false;
  }
}

/**
 * Chamar toda vez que o usuário marca um episódio OU filme como
 * assistido de verdade (nunca ao desmarcar). Seguro de chamar sempre
 * — não faz nada depois que já pediu a avaliação uma vez, e nunca
 * lança erro pra quem chama (falha aqui não pode quebrar a ação real
 * de marcar como assistido).
 */
export async function notifyWatchedAction(count = 1): Promise<void> {
  try {
    if (await hasAlreadyRequested()) return;

    const current = Number((await AsyncStorage.getItem(COUNT_KEY)) ?? "0");
    const next = current + count;
    await AsyncStorage.setItem(COUNT_KEY, String(next));

    if (next < THRESHOLD) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await AsyncStorage.setItem(REQUESTED_KEY, "1");
    await StoreReview.requestReview();
  } catch (error) {
    // Nunca deixa o prompt de avaliação quebrar a ação de marcar
    // como assistido — só loga.
    console.error("[reviewPrompt] Falha ao processar/disparar prompt de avaliação.", error);
  }
}
