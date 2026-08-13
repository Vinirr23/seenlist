import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

/**
 * A PEDIDO (v2 — trocado o gatilho, objetivo explícito de aumentar
 * volume de avaliação na Play Store) — antes disparava só ao
 * terminar uma SÉRIE INTEIRA (todas as temporadas). Trocado pra
 * terminar uma TEMPORADA — acontece bem mais vezes (toda série com
 * mais de uma temporada dá várias chances, não só uma vez), e ainda
 * é uma conquista real (terminou algo de verdade), diferente de um
 * número arbitrário tipo "10º episódio" (que pode disparar cedo
 * demais, ainda na primeira série, sem a pessoa ter formado opinião
 * sobre o app).
 *
 * Regras de bom senso, pra não virar interrupção chata nem gerar
 * avaliação ruim por pedir na hora errada (mais importante ainda
 * agora que o gatilho é mais frequente):
 * - Só a partir da 3ª temporada terminada (subiu de 2 pra 3 — como o
 *   gatilho ficou mais frequente, o limiar de "já é hábito de
 *   verdade" também precisa subir, senão pede cedo demais).
 * - No máximo 1x a cada 90 dias — mantido igual, é o que garante que
 *   virar mais frequente não vire spam.
 * - Guardado no aparelho (`AsyncStorage`), não na conta — reinstalar
 *   o app reseta o contador, o que é aceitável (a própria API do
 *   Android já tem limite de quantas vezes o DIÁLOGO aparece de
 *   verdade por conta Google, independente do que pedirmos aqui).
 *
 * `requestReview()` do Android decide sozinho se MOSTRA o diálogo ou
 * não (tem cota própria, controlada pelo Google, fora do nosso
 * controle) — chamar não garante que a pessoa vai ver nada. Por
 * isso as regras acima são só pra não pedir com frequência abusiva
 * do NOSSO lado, não uma garantia de quando o diálogo aparece.
 */
const COMPLETED_COUNT_KEY = "seenlist:seasons-completed-count";
const LAST_ASKED_KEY = "seenlist:rating-last-asked-at";
const MIN_COMPLETED_SEASONS = 3;
const MIN_DAYS_BETWEEN_ASKS = 90;

/**
 * Chamar UMA VEZ, no momento exato em que uma temporada é concluída
 * (`app/series/[id].tsx`, mesmo padrão de "linha de base" já usado
 * pro confete de série inteira, só que rastreando cada temporada
 * separadamente). Incrementa o contador e, se as regras baterem,
 * pede a avaliação.
 */
export async function maybeRequestReviewAfterSeasonCompleted(): Promise<void> {
  try {
    const rawCount = await AsyncStorage.getItem(COMPLETED_COUNT_KEY);
    const newCount = (rawCount ? parseInt(rawCount, 10) : 0) + 1;
    await AsyncStorage.setItem(COMPLETED_COUNT_KEY, String(newCount));

    if (newCount < MIN_COMPLETED_SEASONS) return;

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
    // Nunca deixa isso quebrar a experiência de terminar a temporada — só registra.
    console.warn("[rating] Falha ao pedir avaliação", error);
  }
}
