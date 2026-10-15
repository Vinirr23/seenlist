/**
 * PILOTO — Conquistas (2026-10-15, a pedido — "quero primeiro aprovar a
 * aparência dos quatro emblemas no tamanho real da tela do SeenList").
 *
 * Registro único por emblema (image + chaves de tradução), exatamente
 * como combinado: nada de duplicar por idioma, nome/descrição/requisito
 * vêm do sistema de tradução (`t()`), só a imagem é fixa.
 *
 * ESCOPO DESTE PILOTO: só os 4 emblemas já aprovados visualmente
 * (Maratonista, Madrugada, Amante de Filmes, Clássicos). Os outros 24
 * da lista completa de 28 NÃO entram aqui ainda — a pedido explícito
 * ("não avance para os outros 24 emblemas").
 *
 * `demoProgress`/`demoUnlocked` são dados de demonstração pra validar a
 * interface (a pedido — "sem alterar o banco ou implementar ainda a
 * lógica de desbloqueio"). Quando a lógica real existir, este módulo
 * troca de fonte (progresso vindo do banco), mas o formato
 * `AchievementDefinition` abaixo não muda.
 */

export type AchievementId = "maratonista" | "madrugada" | "amante-de-filmes" | "classicos";

export interface AchievementDefinition {
  id: AchievementId;
  colorImage: ReturnType<typeof require>;
  lockedImage: ReturnType<typeof require>;
  titleKey: string;
  descriptionKey: string;
  requirementKey: string;
  /** Meta numérica do requisito, só pra calcular a barra de progresso de demonstração — o número já está desenhado na própria imagem, isto aqui NUNCA é renderizado por cima. */
  demoTarget: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "maratonista",
    colorImage: require("@/assets/badges/achievements/maratonista-color.png"),
    lockedImage: require("@/assets/badges/achievements/maratonista-locked.png"),
    titleKey: "achievements.maratonista.title",
    descriptionKey: "achievements.maratonista.description",
    requirementKey: "achievements.maratonista.requirement",
    demoTarget: 10,
  },
  {
    id: "madrugada",
    colorImage: require("@/assets/badges/achievements/madrugada-color.png"),
    lockedImage: require("@/assets/badges/achievements/madrugada-locked.png"),
    titleKey: "achievements.madrugada.title",
    descriptionKey: "achievements.madrugada.description",
    requirementKey: "achievements.madrugada.requirement",
    demoTarget: 1,
  },
  {
    id: "amante-de-filmes",
    colorImage: require("@/assets/badges/achievements/amante-de-filmes-color.png"),
    lockedImage: require("@/assets/badges/achievements/amante-de-filmes-locked.png"),
    titleKey: "achievements.amanteDeFilmes.title",
    descriptionKey: "achievements.amanteDeFilmes.description",
    requirementKey: "achievements.amanteDeFilmes.requirement",
    demoTarget: 10,
  },
  {
    id: "classicos",
    colorImage: require("@/assets/badges/achievements/classicos-color.png"),
    lockedImage: require("@/assets/badges/achievements/classicos-locked.png"),
    titleKey: "achievements.classicos.title",
    descriptionKey: "achievements.classicos.description",
    requirementKey: "achievements.classicos.requirement",
    // CORREÇÃO (bug real, reportado — "640 de 2000" não fazia sentido)
    // — o "2000" desenhado no emblema é o ANO de lançamento (requisito:
    // assistir 1 título lançado antes de 2000), não uma quantidade de
    // filmes a assistir. Era `demoTarget: 2000` (tratando o ano como
    // meta numérica) — o requisito é binário, igual ao Madrugada:
    // `demoTarget: 1`. O número "2000" continua desenhado na própria
    // ilustração (não mexemos nisso), só paramos de usá-lo como meta de
    // progresso.
    demoTarget: 1,
  },
];

/** DEMO — estado de desbloqueio só pra validar a tela (sem banco). */
export const DEMO_UNLOCKED: Record<AchievementId, boolean> = {
  maratonista: true,
  madrugada: false,
  "amante-de-filmes": true,
  classicos: false,
};

/**
 * DEMO — progresso atual só pra validar a barra no detalhe (sem banco).
 * CORREÇÃO (ver `demoTarget` do Clássicos acima) — era `classicos: 640`
 * (não fazia sentido contra uma meta de 1). Binário como o Madrugada:
 * 0 (ainda não assistiu nenhum título pré-2000) ou 1 (já assistiu).
 */
export const DEMO_PROGRESS: Record<AchievementId, number> = {
  maratonista: 10,
  madrugada: 0,
  "amante-de-filmes": 10,
  classicos: 0,
};

/**
 * DEMO — data real de desbloqueio (ISO 8601), quando existir. VAZIO DE
 * PROPÓSITO pros 4 emblemas atuais — não inventamos datas demonstrativas
 * (a pedido explícito, "não inventar datas nem adicionar datas
 * demonstrativas que possam parecer reais"). A tela de detalhe
 * (`app/profile/achievements/[id].tsx`) já está preparada pra mostrar a
 * data quando este campo vier preenchido (do banco, futuramente) — só
 * não renderiza nada enquanto estiver `undefined`, como agora.
 */
export const DEMO_UNLOCKED_AT: Partial<Record<AchievementId, string>> = {};
