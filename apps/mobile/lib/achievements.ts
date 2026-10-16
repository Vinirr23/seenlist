import { supabase } from "@/lib/supabase";
import type { GlowBlob } from "@/components/ui";

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

/**
 * NOVO (2026-10-16, a pedido — "fundo temático por emblema" na tela de
 * detalhe) — uma paleta por conquista. Madrugada (lua azul/dourado) →
 * azul-noite, com estrelas piscando (`showStars`); Clássicos (câmera
 * marrom/dourado) → sépia/bronze — essas duas foram aprovadas de
 * primeira ("ficou perfeito"/"ficou legal").
 *
 * Maratonista e Amante de Filmes originalmente puxavam o VERMELHO da
 * própria PNG de cada um — rejeitado ("os outros 2 não gostei"): o
 * brilho de fundo ficava quase a mesma cor do emblema (vermelho sobre
 * vermelho), tudo achatado, emblema sem destacar. Mandei mockup com 4
 * direções diferentes pra cada um (`achievement-bg-options.html`,
 * SendUserFile, não publicado — mesmo sinal de escolha única de
 * sempre) e o usuário escolheu, por emblema, uma cor FORA da família
 * do vermelho puro do próprio emblema:
 * - Maratonista → "Vinho profundo" (mesma família do vermelho, mas
 *   bem mais escura/rica — sai do achatado sem trocar de família).
 * - Amante de Filmes → "Rosa romântico" (puxa o coraçãozinho do
 *   emblema em vez do rolo de filme vermelho).
 *
 * Reaproveita o `AmbientGlow`/`GlowBlob` que o app já tem em todo
 * lugar (`components/ui/Glass.tsx`) — mesma receita (PNG pré-
 * desfocado tingido por `tintColor`), só com um array de cor diferente
 * por emblema em vez do âmbar/teal genérico padrão. Nenhum asset novo.
 *
 * `haloColor` — cor (mais saturada que os `blobs` de fundo) do brilho
 * que respira bem perto do emblema (pedido: "brilho âmbar e emblema
 * flutuando"), separado do fundo amplo — o fundo é a atmosfera da
 * tela inteira, o halo é o destaque local no próprio emblema. Pra
 * Maratonista/Amante de Filmes, o halo usa a MESMA família de cor
 * escolhida acima (não voltou a ser vermelho puro), só mais clara —
 * mesmo padrão já usado nos outros 2 temas (halo = tom mais vívido do
 * próprio `blobs` primário, não uma cor nova).
 */
export interface AchievementTheme {
  blobs: GlowBlob[];
  haloColor: string;
  showStars?: boolean;
}

export const ACHIEVEMENT_THEMES: Record<AchievementId, AchievementTheme> = {
  maratonista: {
    blobs: [
      { color: "rgba(120,30,50,0.55)", top: -60, left: -120, size: 260 },
      { color: "rgba(80,20,40,0.35)", bottom: -40, right: -110, size: 240 },
    ],
    haloColor: "rgba(170,45,75,0.55)",
  },
  madrugada: {
    blobs: [
      { color: "rgba(58,91,186,0.5)", top: -60, left: -120, size: 260 },
      { color: "rgba(30,50,110,0.4)", bottom: -40, right: -110, size: 240 },
    ],
    haloColor: "rgba(90,130,230,0.55)",
    showStars: true,
  },
  "amante-de-filmes": {
    blobs: [
      { color: "rgba(214,80,130,0.48)", top: -60, left: -120, size: 260 },
      { color: "rgba(232,90,61,0.26)", bottom: -40, right: -110, size: 240 },
    ],
    haloColor: "rgba(224,100,150,0.55)",
  },
  classicos: {
    blobs: [
      { color: "rgba(168,122,61,0.46)", top: -60, left: -120, size: 260 },
      { color: "rgba(120,86,46,0.32)", bottom: -40, right: -110, size: 240 },
    ],
    haloColor: "rgba(196,150,80,0.55)",
  },
};

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

/**
 * NOVO (2026-10-16, a pedido — "raridade social" na tela de detalhe:
 * "só X% dos usuários têm isso") — chama `get_achievement_rarity`
 * (migration `20261016000000`), que calcula a % de usuários que já
 * desbloquearam cada um dos 4 emblemas. SECURITY DEFINER do lado do
 * banco: um usuário normal nunca conseguiria calcular isso sozinho
 * (RLS de `user_achievements` só deixa ler a própria linha) — ver
 * comentário grande na migration pra causa raiz completa.
 *
 * Mostrada tanto desbloqueado quanto bloqueado (decisão do usuário) —
 * bloqueado funciona como incentivo ("só 14% já conseguiram isso").
 * Falha vira mapa vazio (tela simplesmente não mostra o selo de
 * raridade pra nenhum emblema, em vez de quebrar a tela toda por causa
 * de um dado decorativo).
 */
export async function fetchAchievementRarity(): Promise<Partial<Record<AchievementId, number>>> {
  const { data, error } = await supabase.rpc("get_achievement_rarity");

  if (error) {
    console.error("[achievements] Falha ao buscar raridade dos emblemas (decorativo — tela segue sem o selo)", error);
    return {};
  }

  const rarity: Partial<Record<AchievementId, number>> = {};
  for (const row of (data ?? []) as { achievement_id: AchievementId; unlock_percentage: number }[]) {
    rarity[row.achievement_id] = row.unlock_percentage;
  }
  return rarity;
}
