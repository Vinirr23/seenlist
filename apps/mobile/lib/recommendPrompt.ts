import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * A PEDIDO — convite pra recomendar depois de uma avaliação alta.
 *
 * A ideia é ser um lembrete ocasional, nunca um incômodo — então as
 * regras de QUANDO mostrar moram todas aqui, separadas da interface,
 * pra ficarem fáceis de auditar e ajustar sem mexer em tela:
 *
 * 1. Só pra nota 4 ou 5 (quem deu 3 não está entusiasmado o
 *    bastante pra recomendar pra alguém).
 * 2. No máximo 1x por dia.
 * 3. Se a pessoa dispensar 3 vezes SEGUIDAS, para de aparecer de vez
 *    — é um "não" claro o suficiente. Recomendar de verdade zera
 *    esse contador (o convite voltou a ser bem-vindo).
 * 4. Não aparece se a pessoa já recomendou algo nos últimos 7 dias —
 *    quem acabou de recomendar não precisa ser lembrado.
 */
const LAST_SHOWN_KEY = "seenlist:recommend-prompt:last-shown";
const DISMISSALS_KEY = "seenlist:recommend-prompt:consecutive-dismissals";
const LAST_RECOMMENDED_KEY = "seenlist:recommend-prompt:last-recommended";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RECOMMEND_WINDOW_MS = 7 * ONE_DAY_MS;
const MAX_CONSECUTIVE_DISMISSALS = 3;
const MIN_RATING = 4;

export async function shouldShowRecommendPrompt(rating: number): Promise<boolean> {
  if (rating < MIN_RATING) return false;

  try {
    const [lastShown, dismissals, lastRecommended] = await Promise.all([
      AsyncStorage.getItem(LAST_SHOWN_KEY),
      AsyncStorage.getItem(DISMISSALS_KEY),
      AsyncStorage.getItem(LAST_RECOMMENDED_KEY),
    ]);

    if (Number(dismissals ?? 0) >= MAX_CONSECUTIVE_DISMISSALS) return false;
    if (lastShown && Date.now() - Number(lastShown) < ONE_DAY_MS) return false;
    if (lastRecommended && Date.now() - Number(lastRecommended) < RECENT_RECOMMEND_WINDOW_MS) return false;

    return true;
  } catch (error) {
    // Falha de leitura do armazenamento nunca deve atrapalhar a
    // avaliação que a pessoa acabou de fazer — na dúvida, não mostra.
    console.error("[recommendPrompt] Falha ao ler preferências", error);
    return false;
  }
}

export async function markRecommendPromptShown(): Promise<void> {
  await AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now())).catch(() => {});
}

export async function markRecommendPromptDismissed(): Promise<void> {
  try {
    const current = Number((await AsyncStorage.getItem(DISMISSALS_KEY)) ?? 0);
    await AsyncStorage.setItem(DISMISSALS_KEY, String(current + 1));
  } catch (error) {
    console.error("[recommendPrompt] Falha ao registrar dispensa", error);
  }
}

/** Chamado quando a pessoa recomenda de verdade — zera o contador de dispensas e inicia a janela de 7 dias. */
export async function markRecommended(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(DISMISSALS_KEY, "0"),
      AsyncStorage.setItem(LAST_RECOMMENDED_KEY, String(Date.now())),
    ]);
  } catch (error) {
    console.error("[recommendPrompt] Falha ao registrar recomendação", error);
  }
}
