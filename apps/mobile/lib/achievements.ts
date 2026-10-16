import { supabase } from "@/lib/supabase";

/**
 * REAL (2026-10-15, a pedido — "Implementar o desbloqueio real dos 4
 * primeiros") — este módulo trocou de fonte: antes era 100%
 * demonstração (`DEMO_UNLOCKED`/`DEMO_PROGRESS`/`DEMO_UNLOCKED_AT`,
 * sem banco nenhum), agora lê de verdade a tabela `user_achievements`
 * e chama a função `evaluate_and_unlock_achievements` (ambas em
 * `supabase/migrations/20261015000001_user_achievements.sql` e
 * `20261015000002_evaluate_and_unlock_achievements.sql`) — decisões
 * do usuário: tabela persistente (não recálculo a cada leitura) +
 * cálculo via função no Postgres (RPC), não em JavaScript no app.
 *
 * `AchievementDefinition` NÃO mudou de formato (como já estava
 * planejado desde o piloto) — só o campo `demoTarget` virou `target`
 * (deixou de ser "só pra demonstração").
 *
 * ESCOPO: ainda só os 4 emblemas já aprovados (Maratonista, Madrugada,
 * Amante de Filmes, Clássicos). Os outros 24 da lista completa de 28
 * continuam fora, a pedido explícito ("não avance para os outros 24
 * emblemas") — isso não mudou com a entrada do dado real.
 */

export type AchievementId = "maratonista" | "madrugada" | "amante-de-filmes" | "classicos";

export interface AchievementDefinition {
  id: AchievementId;
  colorImage: ReturnType<typeof require>;
  lockedImage: ReturnType<typeof require>;
  titleKey: string;
  descriptionKey: string;
  requirementKey: string;
  /** Meta numérica do requisito, pra calcular a barra de progresso. O número já está desenhado na própria imagem, isto aqui NUNCA é renderizado por cima. */
  target: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "maratonista",
    colorImage: require("@/assets/badges/achievements/maratonista-color.png"),
    lockedImage: require("@/assets/badges/achievements/maratonista-locked.png"),
    titleKey: "achievements.maratonista.title",
    descriptionKey: "achievements.maratonista.description",
    requirementKey: "achievements.maratonista.requirement",
    target: 10,
  },
  {
    id: "madrugada",
    colorImage: require("@/assets/badges/achievements/madrugada-color.png"),
    lockedImage: require("@/assets/badges/achievements/madrugada-locked.png"),
    titleKey: "achievements.madrugada.title",
    descriptionKey: "achievements.madrugada.description",
    requirementKey: "achievements.madrugada.requirement",
    target: 1,
  },
  {
    id: "amante-de-filmes",
    colorImage: require("@/assets/badges/achievements/amante-de-filmes-color.png"),
    lockedImage: require("@/assets/badges/achievements/amante-de-filmes-locked.png"),
    titleKey: "achievements.amanteDeFilmes.title",
    descriptionKey: "achievements.amanteDeFilmes.description",
    requirementKey: "achievements.amanteDeFilmes.requirement",
    target: 10,
  },
  {
    id: "classicos",
    colorImage: require("@/assets/badges/achievements/classicos-color.png"),
    lockedImage: require("@/assets/badges/achievements/classicos-locked.png"),
    titleKey: "achievements.classicos.title",
    descriptionKey: "achievements.classicos.description",
    requirementKey: "achievements.classicos.requirement",
    // O "2000" desenhado no emblema é o ANO de lançamento (requisito:
    // assistir 1 título lançado antes de 2000), não uma quantidade de
    // filmes a assistir — requisito binário, igual ao Madrugada.
    target: 1,
  },
];

export interface AchievementsState {
  unlocked: Record<AchievementId, boolean>;
  unlockedAt: Partial<Record<AchievementId, string>>;
  /**
   * Contagem real de filmes com status "watched" — único dos 4
   * critérios que faz sentido mostrar como progresso numérico
   * acumulado (decisão do usuário: os outros 3 — Maratonista,
   * Madrugada, Clássicos — não acumulam dia após dia, são "bateu ou
   * não bateu" num recorte específico, então ficam em 0 até
   * desbloquear, sem inventar uma métrica de progresso que não existe
   * de verdade).
   */
  moviesWatchedCount: number;
}

/**
 * Chama a função no Postgres que de fato confere os 4 critérios e
 * grava em `user_achievements` o que for novo. Decisão do usuário:
 * só roda quando a tela de Conquistas é aberta (não a cada
 * episódio/filme marcado) — mais barato, um único ponto no código.
 *
 * `offsetMinutes` é EXATAMENTE `new Date().getTimezoneOffset()` —
 * mesma convenção da função SQL (ver comentário grande na migration):
 * o Postgres não guarda o fuso do usuário, e o app nunca usa UTC pra
 * "que dia"/"que hora" (ver `lib/localDate.ts`), por isso o aparelho
 * manda o próprio deslocamento.
 *
 * Retorna os ids desbloqueados NESTA chamada (pra um "parabéns"
 * futuro, se quiser) — hoje ninguém lê esse retorno ainda.
 */
export async function evaluateAndUnlockAchievements(userId: string): Promise<AchievementId[]> {
  const offsetMinutes = new Date().getTimezoneOffset();

  const { data, error } = await supabase.rpc("evaluate_and_unlock_achievements", {
    p_user_id: userId,
    p_utc_offset_minutes: offsetMinutes,
  });

  if (error) {
    console.error("[achievements] Falha ao avaliar/desbloquear conquistas", error);
    return [];
  }

  return (data ?? []) as AchievementId[];
}

/**
 * Lê o estado real: quais emblemas já estão em `user_achievements`
 * (com a data de desbloqueio) + a contagem de filmes assistidos (pro
 * progresso do Amante de Filmes). Chamar DEPOIS de
 * `evaluateAndUnlockAchievements`, pra já refletir um desbloqueio que
 * acabou de acontecer nesta mesma abertura de tela.
 */
export async function fetchAchievementsState(userId: string): Promise<AchievementsState> {
  const [unlockedResult, moviesResult] = await Promise.all([
    supabase.from("user_achievements").select("achievement_id, unlocked_at").eq("user_id", userId),
    supabase
      .from("movie_status")
      .select("movie_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "watched"),
  ]);

  if (unlockedResult.error) {
    console.error("[achievements] Falha ao ler user_achievements", unlockedResult.error);
  }
  if (moviesResult.error) {
    console.error("[achievements] Falha ao contar filmes assistidos", moviesResult.error);
  }

  const unlocked: Record<AchievementId, boolean> = {
    maratonista: false,
    madrugada: false,
    "amante-de-filmes": false,
    classicos: false,
  };
  const unlockedAt: Partial<Record<AchievementId, string>> = {};

  for (const row of unlockedResult.data ?? []) {
    const id = row.achievement_id as AchievementId;
    unlocked[id] = true;
    unlockedAt[id] = row.unlocked_at;
  }

  return {
    unlocked,
    unlockedAt,
    moviesWatchedCount: moviesResult.count ?? 0,
  };
}

/**
 * Progresso pra barra "X de Y" na tela de detalhe. Só o Amante de
 * Filmes tem um número real que faz sentido como progresso contínuo
 * (contagem de filmes assistidos, capada no alvo); os outros 3 ficam
 * em 0 até desbloquear — decisão do usuário, ver comentário em
 * `AchievementsState.moviesWatchedCount`.
 */
export function progressFor(achievement: AchievementDefinition, state: AchievementsState): number {
  if (state.unlocked[achievement.id]) return achievement.target;
  if (achievement.id === "amante-de-filmes") {
    return Math.min(state.moviesWatchedCount, achievement.target);
  }
  return 0;
}
