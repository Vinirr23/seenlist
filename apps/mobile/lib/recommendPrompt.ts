import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";

/**
 * A PEDIDO — convite pra recomendar depois de uma avaliação alta.
 *
 * A ideia é ser um lembrete ocasional, nunca um incômodo — então as
 * regras de QUANDO mostrar moram todas aqui, separadas da interface,
 * pra ficarem fáceis de auditar e ajustar sem mexer em tela.
 *
 * NUNCA mostra se:
 * - A nota foi menor que 4 (quem deu 3 não está entusiasmado o
 *   bastante pra recomendar pra alguém).
 * - A pessoa ainda não terminou a série/filme — o convite é pro
 *   momento de maior entusiasmo, não no meio da segunda temporada.
 * - A pessoa não segue ninguém — sem amigo pra recomendar, o convite
 *   só frustra.
 * - Já recomendou ESSE MESMO título antes (pra qualquer pessoa).
 * - Recomendou qualquer título nos últimos 7 dias — quem acabou de
 *   recomendar não precisa ser lembrado.
 * - Dispensou o convite 3 vezes SEGUIDAS — é um "não" claro o
 *   bastante. Recomendar de verdade zera esse contador: o
 *   comportamento mostrou que a funcionalidade interessa, então as
 *   dispensas antigas deixam de valer.
 * - Já apareceu hoje (no máximo 1x por dia).
 *
 * As checagens locais (armazenamento do aparelho) vêm ANTES das que
 * consultam o banco, de propósito — na maioria das vezes o convite
 * não vai aparecer, e assim nem chega a fazer consulta à toa.
 */
const LAST_SHOWN_KEY = "seenlist:recommend-prompt:last-shown";
const DISMISSALS_KEY = "seenlist:recommend-prompt:consecutive-dismissals";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RECOMMEND_WINDOW_MS = 7 * ONE_DAY_MS;
const MAX_CONSECUTIVE_DISMISSALS = 3;
const MIN_RATING = 4;

export interface RecommendPromptTarget {
  mediaType: "movie" | "series";
  mediaId: number;
}

export async function shouldShowRecommendPrompt(rating: number, target: RecommendPromptTarget): Promise<boolean> {
  if (rating < MIN_RATING) return false;

  try {
    // --- Checagens locais primeiro (sem rede) ---
    const [lastShown, dismissals] = await Promise.all([
      AsyncStorage.getItem(LAST_SHOWN_KEY),
      AsyncStorage.getItem(DISMISSALS_KEY),
    ]);

    if (Number(dismissals ?? 0) >= MAX_CONSECUTIVE_DISMISSALS) return false;
    if (lastShown && Date.now() - Number(lastShown) < ONE_DAY_MS) return false;

    const {
      data: { user },
    } = await getCurrentAuthUser();
    if (!user) return false;

    // --- Checagens no banco, todas em paralelo ---
    const sevenDaysAgo = new Date(Date.now() - RECENT_RECOMMEND_WINDOW_MS).toISOString();
    const [followingResult, recentResult, sameTitleResult, statusResult] = await Promise.all([
      // Segue alguém? (só a contagem, não a lista)
      supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id),
      // Recomendou algo nos últimos 7 dias?
      supabase
        .from("recommendations")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", user.id)
        .gte("created_at", sevenDaysAgo),
      // Já recomendou ESTE título antes?
      supabase
        .from("recommendations")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", user.id)
        .eq("media_type", target.mediaType)
        .eq("media_id", target.mediaId),
      // Terminou de assistir?
      target.mediaType === "series"
        ? supabase
            .from("series_status")
            .select("status")
            .eq("user_id", user.id)
            .eq("series_id", target.mediaId)
            .maybeSingle()
        : supabase
            .from("movie_status")
            .select("status")
            .eq("user_id", user.id)
            .eq("movie_id", target.mediaId)
            .maybeSingle(),
    ]);

    if ((followingResult.count ?? 0) === 0) return false;
    if ((recentResult.count ?? 0) > 0) return false;
    if ((sameTitleResult.count ?? 0) > 0) return false;

    // Série: "completed". Filme: "watched" (nomes diferentes por
    // tabela, mesma ideia de "terminei").
    const status = (statusResult.data as { status?: string } | null)?.status;
    const finished = target.mediaType === "series" ? status === "completed" : status === "watched";
    if (!finished) return false;

    return true;
  } catch (error) {
    // Nada aqui pode atrapalhar a avaliação que a pessoa acabou de
    // fazer — na dúvida, não mostra.
    console.error("[recommendPrompt] Falha ao avaliar regras do convite", error);
    return false;
  }
}

export async function markRecommendPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch (error) {
    console.error("[recommendPrompt] Falha ao registrar exibição", error);
  }
}

export async function markRecommendPromptDismissed(): Promise<void> {
  try {
    const current = Number((await AsyncStorage.getItem(DISMISSALS_KEY)) ?? 0);
    await AsyncStorage.setItem(DISMISSALS_KEY, String(current + 1));
  } catch (error) {
    console.error("[recommendPrompt] Falha ao registrar dispensa", error);
  }
}

/**
 * Zera o contador de dispensas. Chamado quando a pessoa aceita o
 * convite — a janela de 7 dias NÃO é guardada aqui: ela é lida
 * direto da tabela `recommendations`, então vale pra recomendação
 * feita por qualquer caminho (inclusive pelo menu "..." de uma
 * série), não só pelas que passaram por este convite.
 */
export async function markRecommendPromptAccepted(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSALS_KEY, "0");
  } catch (error) {
    console.error("[recommendPrompt] Falha ao zerar dispensas", error);
  }
}
