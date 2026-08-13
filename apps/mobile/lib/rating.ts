import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

/**
 * A PEDIDO — avaliação na Play Store, pedida no momento certo.
 *
 * Regras de bom senso, pra não virar interrupção chata nem gerar
 * avaliação ruim por pedir na hora errada:
 * - Só depois de terminar pelo menos a 2ª série (a primeira pode ser
 *   sorte/curiosidade; terminar a segunda já é sinal de hábito real).
 * - No máximo 1x a cada 90 dias — mesmo satisfeito, ninguém quer ser
 *   perguntado toda vez que termina uma série.
 * - Guardado no aparelho (`AsyncStorage`), não na conta — reinstalar
 *   o app reresta o contador, o que é aceitável (a própria API do
 *   Android já tem limite de quantas vezes o DIÁLOGO aparece de
 *   verdade por conta Google, independente do que pedirmos aqui).
 *
 * `requestReview()` do Android decide sozinho se MOSTRA o diálogo ou
 * não (tem cota própria, controlada pelo Google, fora do nosso
 * controle) — chamar não garante que a pessoa vai ver nada. Por
 * isso as regras acima são só pra não pedir com frequência abusiva
 * do NOSSO lado, não uma garantia de quando o diálogo aparece.
 */
const COMPLETED_COUNT_KEY = "seenlist:series-completed-count";
const LAST_ASKED_KEY = "seenlist:rating-last-asked-at";
const MIN_COMPLETED_SERIES = 2;
const MIN_DAYS_BETWEEN_ASKS = 90;

/**
 * Chamar UMA VEZ, no momento exato em que uma série é concluída
 * (mesmo lugar do confete — `app/series/[id].tsx`). Incrementa o
 * contador e, se as regras baterem, pede a avaliação.
 */
export async function maybeRequestReviewAfterSeriesCompleted(): Promise<void> {
  try {
    const rawCount = await AsyncStorage.getItem(COMPLETED_COUNT_KEY);
    const newCount = (rawCount ? parseInt(rawCount, 10) : 0) + 1;
    await AsyncStorage.setItem(COMPLETED_COUNT_KEY, String(newCount));

    if (newCount < MIN_COMPLETED_SERIES) return;

    const lastAskedRaw = await AsyncStorage.getItem(LAST_ASKED_KEY);
    if (lastAskedRaw) {
      const daysSince = (Date.now() - Number(lastAskedRaw)) / (1000 * 60 * 60 * 24);
      if (daysSince < MIN_DAYS_BETWEEN_ASKS) return;
    }

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await AsyncStorage.setItem(LAST_ASKED_KEY, String(Date.now()));
    await StoreReview.requestReview();
  } catch (error) {
    // Nunca deixa isso quebrar a comemoração de terminar a série — só registra.
    console.warn("[rating] Falha ao pedir avaliação", error);
  }
}
