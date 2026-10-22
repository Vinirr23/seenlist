import { supabase } from "@/lib/supabase";
import type { GlowBlob } from "@/components/ui";

/**
 * EXPANDIDO (2026-10-17, etapa de UI dos 24 emblemas restantes — banco
 * e backend já implementados e validados contra dado real numa sessão
 * anterior, ver `claude/SEENLIST-SESSAO-2026-10-17-...` no projeto).
 * Até aqui este módulo só conhecia os 4 emblemas piloto (Maratonista,
 * Madrugada, Amante de Filmes, Clássicos) — por pedido explícito do
 * usuário, que queria banco/backend prontos primeiro, sem tocar na
 * interface. Agora que isso foi testado e aprovado, a lista cresce
 * pros 28 — a arte (PNG cor+bloqueado) dos 24 novos já existia
 * salva em `assets/badges/achievements/` desde uma sessão anterior
 * (zip `seenlist-56-emblemas-final.zip`), só a lógica/tela nunca
 * tinham sido ligadas a ela.
 *
 * `AchievementDefinition` não mudou de formato — só a lista cresceu.
 */

export type AchievementId =
  | "maratonista"
  | "madrugada"
  | "amante-de-filmes"
  | "classicos"
  | "primeiro-passo"
  | "temporada-concluida"
  | "avaliador"
  | "comentarista"
  | "social"
  | "favoritou"
  | "centenario"
  | "cinetrao"
  | "finalista"
  | "em-dia"
  | "watchlist"
  | "organizado"
  | "colecionador"
  | "semana-ativa"
  | "consistente"
  | "viciado"
  | "binge-master"
  | "fa-assiduo"
  | "drama-lover"
  | "comedia-em-dia"
  | "explorador"
  | "nomade"
  | "pelo-mundo"
  | "top-1-por-cento";

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
  // ---------------------------------------------------------------
  // 24 NOVOS (2026-10-17) — mesma ordem da tabela de critérios do
  // plano técnico aprovado. `target` reflete o critério aprovado;
  // se algum número bater diferente do que está desenhado na PNG
  // real (não conferido visualmente, um por um, nesta rodada —
  // decisão do usuário: tema de cor sim foi conferido no padrão,
  // número da imagem não), avisar pra eu corrigir.
  // ---------------------------------------------------------------
  {
    id: "primeiro-passo",
    colorImage: require("@/assets/badges/achievements/primeiro-passo-color.png"),
    lockedImage: require("@/assets/badges/achievements/primeiro-passo-locked.png"),
    titleKey: "achievements.primeiroPasso.title",
    descriptionKey: "achievements.primeiroPasso.description",
    requirementKey: "achievements.primeiroPasso.requirement",
    target: 1,
  },
  {
    id: "temporada-concluida",
    colorImage: require("@/assets/badges/achievements/temporada-concluida-color.png"),
    lockedImage: require("@/assets/badges/achievements/temporada-concluida-locked.png"),
    titleKey: "achievements.temporadaConcluida.title",
    descriptionKey: "achievements.temporadaConcluida.description",
    requirementKey: "achievements.temporadaConcluida.requirement",
    target: 1,
  },
  {
    id: "avaliador",
    colorImage: require("@/assets/badges/achievements/avaliador-color.png"),
    lockedImage: require("@/assets/badges/achievements/avaliador-locked.png"),
    titleKey: "achievements.avaliador.title",
    descriptionKey: "achievements.avaliador.description",
    requirementKey: "achievements.avaliador.requirement",
    target: 10,
  },
  {
    id: "comentarista",
    colorImage: require("@/assets/badges/achievements/comentarista-color.png"),
    lockedImage: require("@/assets/badges/achievements/comentarista-locked.png"),
    titleKey: "achievements.comentarista.title",
    descriptionKey: "achievements.comentarista.description",
    requirementKey: "achievements.comentarista.requirement",
    target: 25,
  },
  {
    id: "social",
    colorImage: require("@/assets/badges/achievements/social-color.png"),
    lockedImage: require("@/assets/badges/achievements/social-locked.png"),
    titleKey: "achievements.social.title",
    descriptionKey: "achievements.social.description",
    requirementKey: "achievements.social.requirement",
    target: 10,
  },
  {
    id: "favoritou",
    colorImage: require("@/assets/badges/achievements/favoritou-color.png"),
    lockedImage: require("@/assets/badges/achievements/favoritou-locked.png"),
    titleKey: "achievements.favoritou.title",
    descriptionKey: "achievements.favoritou.description",
    requirementKey: "achievements.favoritou.requirement",
    target: 20,
  },
  {
    id: "centenario",
    colorImage: require("@/assets/badges/achievements/centenario-color.png"),
    lockedImage: require("@/assets/badges/achievements/centenario-locked.png"),
    titleKey: "achievements.centenario.title",
    descriptionKey: "achievements.centenario.description",
    requirementKey: "achievements.centenario.requirement",
    target: 100,
  },
  {
    id: "cinetrao",
    colorImage: require("@/assets/badges/achievements/cinetrao-color.png"),
    lockedImage: require("@/assets/badges/achievements/cinetrao-locked.png"),
    titleKey: "achievements.cinetrao.title",
    descriptionKey: "achievements.cinetrao.description",
    requirementKey: "achievements.cinetrao.requirement",
    target: 500,
  },
  {
    id: "finalista",
    colorImage: require("@/assets/badges/achievements/finalista-color.png"),
    lockedImage: require("@/assets/badges/achievements/finalista-locked.png"),
    titleKey: "achievements.finalista.title",
    descriptionKey: "achievements.finalista.description",
    requirementKey: "achievements.finalista.requirement",
    target: 10,
  },
  {
    id: "em-dia",
    colorImage: require("@/assets/badges/achievements/em-dia-color.png"),
    lockedImage: require("@/assets/badges/achievements/em-dia-locked.png"),
    titleKey: "achievements.emDia.title",
    descriptionKey: "achievements.emDia.description",
    requirementKey: "achievements.emDia.requirement",
    target: 5,
  },
  {
    id: "watchlist",
    colorImage: require("@/assets/badges/achievements/watchlist-color.png"),
    lockedImage: require("@/assets/badges/achievements/watchlist-locked.png"),
    titleKey: "achievements.watchlist.title",
    descriptionKey: "achievements.watchlist.description",
    requirementKey: "achievements.watchlist.requirement",
    target: 50,
  },
  {
    id: "organizado",
    colorImage: require("@/assets/badges/achievements/organizado-color.png"),
    lockedImage: require("@/assets/badges/achievements/organizado-locked.png"),
    titleKey: "achievements.organizado.title",
    descriptionKey: "achievements.organizado.description",
    requirementKey: "achievements.organizado.requirement",
    target: 3,
  },
  {
    id: "colecionador",
    colorImage: require("@/assets/badges/achievements/colecionador-color.png"),
    lockedImage: require("@/assets/badges/achievements/colecionador-locked.png"),
    titleKey: "achievements.colecionador.title",
    descriptionKey: "achievements.colecionador.description",
    requirementKey: "achievements.colecionador.requirement",
    target: 100,
  },
  {
    id: "semana-ativa",
    colorImage: require("@/assets/badges/achievements/semana-ativa-color.png"),
    lockedImage: require("@/assets/badges/achievements/semana-ativa-locked.png"),
    titleKey: "achievements.semanaAtiva.title",
    descriptionKey: "achievements.semanaAtiva.description",
    requirementKey: "achievements.semanaAtiva.requirement",
    target: 7,
  },
  {
    id: "consistente",
    colorImage: require("@/assets/badges/achievements/consistente-color.png"),
    lockedImage: require("@/assets/badges/achievements/consistente-locked.png"),
    titleKey: "achievements.consistente.title",
    descriptionKey: "achievements.consistente.description",
    requirementKey: "achievements.consistente.requirement",
    target: 30,
  },
  {
    id: "viciado",
    colorImage: require("@/assets/badges/achievements/viciado-color.png"),
    lockedImage: require("@/assets/badges/achievements/viciado-locked.png"),
    titleKey: "achievements.viciado.title",
    descriptionKey: "achievements.viciado.description",
    requirementKey: "achievements.viciado.requirement",
    target: 50,
  },
  {
    id: "binge-master",
    colorImage: require("@/assets/badges/achievements/binge-master-color.png"),
    lockedImage: require("@/assets/badges/achievements/binge-master-locked.png"),
    titleKey: "achievements.bingeMaster.title",
    descriptionKey: "achievements.bingeMaster.description",
    requirementKey: "achievements.bingeMaster.requirement",
    target: 20,
  },
  {
    id: "fa-assiduo",
    colorImage: require("@/assets/badges/achievements/fa-assiduo-color.png"),
    lockedImage: require("@/assets/badges/achievements/fa-assiduo-locked.png"),
    titleKey: "achievements.faAssiduo.title",
    descriptionKey: "achievements.faAssiduo.description",
    requirementKey: "achievements.faAssiduo.requirement",
    target: 100,
  },
  {
    id: "drama-lover",
    colorImage: require("@/assets/badges/achievements/drama-lover-color.png"),
    lockedImage: require("@/assets/badges/achievements/drama-lover-locked.png"),
    titleKey: "achievements.dramaLover.title",
    descriptionKey: "achievements.dramaLover.description",
    requirementKey: "achievements.dramaLover.requirement",
    target: 30,
  },
  {
    id: "comedia-em-dia",
    colorImage: require("@/assets/badges/achievements/comedia-em-dia-color.png"),
    lockedImage: require("@/assets/badges/achievements/comedia-em-dia-locked.png"),
    titleKey: "achievements.comediaEmDia.title",
    descriptionKey: "achievements.comediaEmDia.description",
    requirementKey: "achievements.comediaEmDia.requirement",
    target: 30,
  },
  {
    id: "explorador",
    colorImage: require("@/assets/badges/achievements/explorador-color.png"),
    lockedImage: require("@/assets/badges/achievements/explorador-locked.png"),
    titleKey: "achievements.explorador.title",
    descriptionKey: "achievements.explorador.description",
    requirementKey: "achievements.explorador.requirement",
    target: 10,
  },
  {
    id: "nomade",
    colorImage: require("@/assets/badges/achievements/nomade-color.png"),
    lockedImage: require("@/assets/badges/achievements/nomade-locked.png"),
    titleKey: "achievements.nomade.title",
    descriptionKey: "achievements.nomade.description",
    requirementKey: "achievements.nomade.requirement",
    // Critério composto (10 títulos de ≥5 países) — "5" aqui é só pra
    // ter um número coerente com a descrição; o progresso fica
    // binário (ver `progressFor`), não uma barra parcial real.
    target: 5,
  },
  {
    id: "pelo-mundo",
    colorImage: require("@/assets/badges/achievements/pelo-mundo-color.png"),
    lockedImage: require("@/assets/badges/achievements/pelo-mundo-locked.png"),
    titleKey: "achievements.peloMundo.title",
    descriptionKey: "achievements.peloMundo.description",
    requirementKey: "achievements.peloMundo.requirement",
    target: 15,
  },
  {
    id: "top-1-por-cento",
    colorImage: require("@/assets/badges/achievements/top-1-por-cento-color.png"),
    lockedImage: require("@/assets/badges/achievements/top-1-por-cento-locked.png"),
    titleKey: "achievements.top1PorCento.title",
    descriptionKey: "achievements.top1PorCento.description",
    requirementKey: "achievements.top1PorCento.requirement",
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
 *
 * TEMA DOS 24 NOVOS (2026-10-17) — decisão explícita do usuário:
 * tema neutro compartilhado por enquanto (grafite/âmbar), em vez de
 * eu escolher uma cor "no escuro" olhando só o nome de cada emblema,
 * sem ter conferido a arte real de cada PNG um por um (foi isso que
 * se fez pros 4 originais, e deu retrabalho quando a cor não combinou
 * — ver comentário acima). Ajustar cor por cor, se quiser, é só
 * trocar a entrada correspondente aqui depois de ver a tela real.
 */
export interface AchievementTheme {
  blobs: GlowBlob[];
  haloColor: string;
  showStars?: boolean;
}

/**
 * SEM MANCHAS DE FUNDO (2026-10-16, a pedido explícito — "tira as
 * manchas de todos, menos o da madrugada que combina com a noite") —
 * `blobs` zerado em todos os temas EXCETO `madrugada` (ver mais
 * abaixo, única entrada que manteve o array original). `haloColor`
 * continua intacto em todo tema — é o brilho LOCAL que respira perto
 * do próprio emblema (destaque, não "atmosfera" de tela inteira,
 * ver comentário grande logo acima desta constante), não foi pedido
 * pra tirar.
 */
const NEUTRAL_THEME: AchievementTheme = {
  blobs: [],
  haloColor: "rgba(200,170,110,0.5)",
};

const NEW_ACHIEVEMENT_IDS_WITH_NEUTRAL_THEME: AchievementId[] = [
  "primeiro-passo",
  "temporada-concluida",
  "avaliador",
  "comentarista",
  "social",
  "favoritou",
  "centenario",
  "cinetrao",
  "finalista",
  "em-dia",
  "watchlist",
  "organizado",
  "colecionador",
  "semana-ativa",
  "consistente",
  "viciado",
  "binge-master",
  "fa-assiduo",
  "drama-lover",
  "comedia-em-dia",
  "explorador",
  "nomade",
  "pelo-mundo",
  "top-1-por-cento",
];

export const ACHIEVEMENT_THEMES: Record<AchievementId, AchievementTheme> = {
  // `blobs: [] as GlowBlob[]` (a pedido — ver comentário grande junto
  // de `NEUTRAL_THEME`, acima). A anotação explícita é necessária —
  // sem ela, `[]` infere como `never[]`, e o `tsc` rejeita o `as
  // Record<AchievementId, AchievementTheme>` no fim do objeto inteiro
  // (erro real, achado rodando `tsc --noEmit`: "Conversion... may be a
  // mistake because neither type sufficiently overlaps"). `haloColor`
  // mantido em todos.
  maratonista: {
    blobs: [] as GlowBlob[],
    haloColor: "rgba(170,45,75,0.55)",
  },
  // ÚNICO tema que manteve as manchas de fundo — pedido explícito do
  // usuário: "menos o da madrugada que combina com a noite".
  madrugada: {
    blobs: [
      { color: "rgba(58,91,186,0.5)", top: -60, left: -120, size: 260 },
      { color: "rgba(30,50,110,0.4)", bottom: -40, right: -110, size: 240 },
    ],
    haloColor: "rgba(90,130,230,0.55)",
    showStars: true,
  },
  "amante-de-filmes": {
    blobs: [] as GlowBlob[],
    haloColor: "rgba(224,100,150,0.55)",
  },
  classicos: {
    blobs: [] as GlowBlob[],
    haloColor: "rgba(196,150,80,0.55)",
  },
  ...Object.fromEntries(NEW_ACHIEVEMENT_IDS_WITH_NEUTRAL_THEME.map((id) => [id, NEUTRAL_THEME])),
} as Record<AchievementId, AchievementTheme>;

export interface AchievementsState {
  unlocked: Record<AchievementId, boolean>;
  unlockedAt: Partial<Record<AchievementId, string>>;
  /**
   * NOVO (2026-10-16, selo "Novo" + celebração de desbloqueio movida
   * pra um fato persistente no banco — ver migration
   * `20261017000009_user_achievements_celebrated_at.sql` pra causa raiz
   * completa de por que o sinal antigo, "a função de desbloqueio
   * devolveu este id NESTA chamada", nunca disparava pra conquistas já
   * desbloqueadas antes da celebração existir). Presente (com uma
   * data) = já visto; ausente = ainda não visto — emblema
   * desbloqueado SEM entrada aqui é exatamente "novo, ainda não
   * celebrado" (`isNewAndUncelebrated` abaixo).
   */
  celebratedAt: Partial<Record<AchievementId, string>>;
  /**
   * Contagem real de filmes com status "watched" — reaproveitada por
   * Amante de Filmes, Centenário e Cinetrão (mesma métrica, limiares
   * diferentes).
   */
  moviesWatchedCount: number;
  /**
   * NOVO (2026-10-17) — as 8 contagens que vêm de
   * `get_achievement_progress_counts` (ver migration
   * `20261017000005`), uma função só no Postgres em vez de 8 queries
   * separadas no cliente — necessário porque Watchlist e Colecionador
   * são UNIÃO deduplicada de duas tabelas, o que o `supabase-js` não
   * faz sozinho sem buscar tudo e deduplicar em JS.
   *
   * EXPANDIDO (2026-10-17, mesma sessão — depois de corrigir o bug
   * real de Drama Lover/Comédia em Dia, ver `progressFor` abaixo) —
   * mais 4 contagens (`countriesCount`/`dramaTitlesCount`/
   * `comedyTitlesCount`/`genresCount`), de `20261017000008`. Pelo
   * Mundo, Drama Lover, Comédia em Dia e Explorador saíram do grupo
   * "fica em 0 até desbloquear" (ver comentário grande em
   * `progressFor`) — são contagens simples de verdade, só não tinham
   * sido ligadas ainda.
   */
  progressCounts: {
    reviewsCount: number;
    commentsCount: number;
    followingCount: number;
    favoritesCount: number;
    completedSeriesCount: number;
    upToDateSeriesCount: number;
    watchlistCount: number;
    libraryCount: number;
    countriesCount: number;
    dramaTitlesCount: number;
    comedyTitlesCount: number;
    genresCount: number;
  };
}

const EMPTY_PROGRESS_COUNTS: AchievementsState["progressCounts"] = {
  reviewsCount: 0,
  commentsCount: 0,
  followingCount: 0,
  favoritesCount: 0,
  completedSeriesCount: 0,
  upToDateSeriesCount: 0,
  watchlistCount: 0,
  libraryCount: 0,
  countriesCount: 0,
  dramaTitlesCount: 0,
  comedyTitlesCount: 0,
  genresCount: 0,
};

/**
 * NOVO (2026-10-17) — antes, as duas telas que usam este módulo
 * (`app/profile/achievements.tsx` e `app/profile/achievements/[id].tsx`)
 * tinham CADA UMA a sua própria constante `EMPTY_STATE`, escrita à mão
 * com só os 4 ids piloto (`{maratonista: false, madrugada: false, ...}`)
 * — ia quebrar o `tsc` das duas (faltando as outras 24 chaves de
 * `unlocked` e o campo `progressCounts`, os dois agora obrigatórios em
 * `AchievementsState`) e, pior, exigiria lembrar de atualizar 2 lugares
 * toda vez que um emblema novo for adicionado no futuro. Centralizado
 * aqui, derivado de `ACHIEVEMENTS` (nunca mais precisa tocar nisso de
 * novo quando a lista crescer) — as duas telas passam a importar esta
 * constante em vez de ter a própria.
 */
export const EMPTY_ACHIEVEMENTS_STATE: AchievementsState = {
  unlocked: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, false])) as Record<AchievementId, boolean>,
  unlockedAt: {},
  celebratedAt: {},
  moviesWatchedCount: 0,
  progressCounts: EMPTY_PROGRESS_COUNTS,
};

/**
 * Um emblema é "novo" (mostra o selo "Novo" na grade e dispara a
 * celebração ao abrir a tela de detalhe) exatamente quando está
 * desbloqueado E ainda não tem `celebratedAt` — ver comentário grande
 * em `AchievementsState.celebratedAt` pra causa raiz completa.
 * Centralizado aqui (em vez de cada tela calcular
 * `unlocked && !celebratedAt[id]` na mão) pra nunca divergir entre a
 * grade e a tela de detalhe.
 */
export function isNewAndUncelebrated(id: AchievementId, state: AchievementsState): boolean {
  return state.unlocked[id] && !state.celebratedAt[id];
}

/**
 * Chama a função no Postgres que de fato confere os critérios e grava
 * em `user_achievements` o que for novo. Decisão do usuário: só roda
 * quando a tela de Conquistas é aberta (não a cada episódio/filme
 * marcado) — mais barato, um único ponto no código.
 *
 * `offsetMinutes` é EXATAMENTE `new Date().getTimezoneOffset()` —
 * mesma convenção da função SQL (ver comentário grande na migration):
 * o Postgres não guarda o fuso do usuário, e o app nunca usa UTC pra
 * "que dia"/"que hora" (ver `lib/localDate.ts`), por isso o aparelho
 * manda o próprio deslocamento.
 *
 * Retorna os ids desbloqueados NESTA chamada — usado pela animação de
 * celebração em `app/profile/achievements/[id].tsx`.
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
 * Marca este emblema como "já celebrado" pro usuário logado —
 * chamado pela tela de detalhe assim que ela decide celebrar (ver
 * `isNewAndUncelebrated`), pra que a próxima abertura (mesmo
 * reabrindo o app, mesmo em outro aparelho) nunca mais mostre o selo
 * "Novo" nem toque a animação de novo. RPC `security definer` (ver
 * migration `20261017000009`) — o cliente não tem policy de update
 * direta em `user_achievements`, de propósito, então só pode marcar
 * via esta função, que só grava na PRÓPRIA linha do usuário logado
 * (`auth.uid()` no banco, nunca um id recebido daqui). Falha aqui
 * nunca deve travar a tela (na pior hipótese, o selo "Novo" volta a
 * aparecer numa próxima abertura — chato, não quebra nada) — por isso
 * só loga, não propaga erro.
 */
export async function markAchievementCelebrated(achievementId: AchievementId): Promise<void> {
  const { error } = await supabase.rpc("mark_achievement_celebrated", { p_achievement_id: achievementId });
  if (error) {
    console.error("[achievements] Falha ao marcar conquista como celebrada", error);
  }
}

/**
 * Lê o estado real: quais emblemas já estão em `user_achievements`
 * (com a data de desbloqueio) + as contagens pra barra de progresso
 * (filmes assistidos + as 8 novas de `get_achievement_progress_counts`).
 * Chamar DEPOIS de `evaluateAndUnlockAchievements`, pra já refletir um
 * desbloqueio que acabou de acontecer nesta mesma abertura de tela.
 */
export async function fetchAchievementsState(userId: string): Promise<AchievementsState> {
  const [unlockedResult, moviesResult, progressResult] = await Promise.all([
    supabase.from("user_achievements").select("achievement_id, unlocked_at, celebrated_at").eq("user_id", userId),
    supabase
      .from("movie_status")
      .select("movie_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "watched"),
    supabase.rpc("get_achievement_progress_counts", { p_user_id: userId }),
  ]);

  if (unlockedResult.error) {
    // CORREÇÃO DE RAIZ (2026-10-20, bug real reportado — tela de
    // Conquistas (grade) mostrando TUDO bloqueado/cinza mesmo com
    // emblemas já concedidos de verdade em `user_achievements`,
    // enquanto a tela de DETALHE do mesmo emblema (`[id].tsx`, que
    // chama esta mesma função separadamente) mostrava corretamente
    // "Conquista desbloqueada!". Evidência decisiva: as barras de
    // progresso (de `get_achievement_progress_counts`, lida na MESMA
    // chamada, em paralelo) continuavam batendo com os dados reais do
    // usuário — ou seja, não era um problema de rede/sessão geral,
    // era especificamente ESTA consulta (`user_achievements`) falhando
    // nessa chamada, enquanto as outras duas (contagem de filmes,
    // progresso) funcionavam. Antes, essa falha só era logada
    // (`console.error`) e depois tratada como "nada desbloqueado"
    // (`unlockedResult.data ?? []` virava `[]`) — a função nunca
    // lançava exceção nesse caso. Isso IMPEDIA o mecanismo de
    // retentativa automática + aviso "Tentar de novo" que já existe em
    // `runSync()` (`app/profile/achievements.tsx`) de agir — aquele
    // mecanismo só reconhece falha quando esta função LANÇA, e esta
    // nunca lançava. Resultado: a tela ficava presa mostrando um
    // estado "tudo bloqueado" que nem é o cache antigo nem é a
    // verdade, sem nenhum aviso de erro, de forma silenciosa e
    // indefinida — pra QUALQUER usuário que tivesse o azar dessa
    // consulta específica falhar uma vez (soluço de rede, timing de
    // RLS logo após um `insert`, etc.), não só o usuário que reportou.
    // CORREÇÃO: propaga o erro de verdade (lança), igual a qualquer
    // outra falha real de sincronização — o cache/estado anterior
    // continua na tela (nunca em branco) e a retentativa automática
    // entra em ação, exatamente como já acontecia pras outras causas
    // de falha.
    console.error("[achievements] Falha ao ler user_achievements", unlockedResult.error);
    throw new Error(`Falha ao ler user_achievements: ${unlockedResult.error.message}`);
  }
  if (moviesResult.error) {
    console.error("[achievements] Falha ao contar filmes assistidos", moviesResult.error);
  }
  if (progressResult.error) {
    console.error("[achievements] Falha ao ler get_achievement_progress_counts", progressResult.error);
  }

  const unlocked = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, false])) as Record<AchievementId, boolean>;
  const unlockedAt: Partial<Record<AchievementId, string>> = {};
  const celebratedAt: Partial<Record<AchievementId, string>> = {};

  for (const row of unlockedResult.data ?? []) {
    const id = row.achievement_id as AchievementId;
    unlocked[id] = true;
    unlockedAt[id] = row.unlocked_at;
    // Só preenche quando NÃO nulo — ausência da chave é o próprio
    // sinal de "ainda não celebrado" (ver `isNewAndUncelebrated`).
    if (row.celebrated_at) celebratedAt[id] = row.celebrated_at;
  }

  // `get_achievement_progress_counts` devolve uma única linha com as 8
  // contagens — falha ou ausência (nunca deveria faltar, mas um dado
  // decorativo nunca pode quebrar a tela) vira tudo zero, igual já
  // acontecia pros outros campos decorativos deste módulo.
  const progressRow = (progressResult.data?.[0] ?? null) as
    | {
        reviews_count: number;
        comments_count: number;
        following_count: number;
        favorites_count: number;
        completed_series_count: number;
        up_to_date_series_count: number;
        watchlist_count: number;
        library_count: number;
        countries_count: number;
        drama_titles_count: number;
        comedy_titles_count: number;
        genres_count: number;
      }
    | null;

  return {
    unlocked,
    unlockedAt,
    celebratedAt,
    moviesWatchedCount: moviesResult.count ?? 0,
    progressCounts: progressRow
      ? {
          reviewsCount: progressRow.reviews_count,
          commentsCount: progressRow.comments_count,
          followingCount: progressRow.following_count,
          favoritesCount: progressRow.favorites_count,
          completedSeriesCount: progressRow.completed_series_count,
          upToDateSeriesCount: progressRow.up_to_date_series_count,
          watchlistCount: progressRow.watchlist_count,
          libraryCount: progressRow.library_count,
          countriesCount: progressRow.countries_count,
          dramaTitlesCount: progressRow.drama_titles_count,
          comedyTitlesCount: progressRow.comedy_titles_count,
          genresCount: progressRow.genres_count,
        }
      : EMPTY_PROGRESS_COUNTS,
  };
}

/**
 * Progresso pra barra "X de Y" na tela de detalhe.
 *
 * EXPANDIDO (2026-10-17) — além do Amante de Filmes (já existia),
 * agora mostram progresso numérico real: Centenário/Cinetrão (mesma
 * contagem do Amante de Filmes, limiar diferente), e os 8 que vêm de
 * `progressCounts` (Avaliador, Comentarista, Social, Favoritou,
 * Finalista, Em Dia, Watchlist, Colecionador) — todos contagens
 * simples, sem ambiguidade de "o que mostrar".
 *
 * EXPANDIDO DE NOVO (2026-10-17, mesma sessão — bug reportado: "como
 * pode Nômade estar desbloqueado e Pelo Mundo em 0/15?") — Pelo
 * Mundo, Drama Lover, Comédia em Dia e Explorador tinham sido
 * colocados no grupo "critério composto, não dá pra mostrar barra"
 * por engano: os quatro são, na real, CONTAGENS SIMPLES (países
 * distintos / títulos distintos por gênero / gêneros distintos), sem
 * nenhuma ambiguidade — só não tinham uma função no banco que as
 * calculasse ainda. Agora vêm de `progressCounts`
 * (`countriesCount`/`dramaTitlesCount`/`comedyTitlesCount`/
 * `genresCount`, migration `20261017000008`), mesma query (já
 * corrigida) que `evaluate_and_unlock_achievements` usa pra decidir o
 * desbloqueio — número de progresso e critério de desbloqueio nascem
 * da MESMA contagem, nunca podem divergir.
 *
 * Nômade CONTINUA em 0 até desbloquear, de propósito — diferente de
 * Pelo Mundo, o critério dele é genuinamente composto (precisa de
 * ≥10 títulos E ≥5 países ao mesmo tempo, duas dimensões), não cabe
 * num único número sem esconder uma das duas condições.
 *
 * Os demais continuam em 0 até desbloquear — decisão já registrada no
 * plano técnico aprovado: sequências (Semana Ativa, Consistente,
 * Viciado, Binge Master), Organizado (composto: 3 listas E ≥5 itens
 * cada), Nômade (ver acima), Top 1% (não é "quantidade", é posição
 * num ranking) e os "bateu ou não bateu" sem contagem natural
 * (Primeiro Passo, Temporada Concluída, Fã Assíduo, Madrugada,
 * Clássicos) — não inventar uma barra parcial pra critério que não é
 * uma contagem simples e linear.
 */
export function progressFor(achievement: AchievementDefinition, state: AchievementsState): number {
  if (state.unlocked[achievement.id]) return achievement.target;

  switch (achievement.id) {
    case "amante-de-filmes":
    case "centenario":
    case "cinetrao":
      return Math.min(state.moviesWatchedCount, achievement.target);
    case "avaliador":
      return Math.min(state.progressCounts.reviewsCount, achievement.target);
    case "comentarista":
      return Math.min(state.progressCounts.commentsCount, achievement.target);
    case "social":
      return Math.min(state.progressCounts.followingCount, achievement.target);
    case "favoritou":
      return Math.min(state.progressCounts.favoritesCount, achievement.target);
    case "finalista":
      return Math.min(state.progressCounts.completedSeriesCount, achievement.target);
    case "em-dia":
      return Math.min(state.progressCounts.upToDateSeriesCount, achievement.target);
    case "watchlist":
      return Math.min(state.progressCounts.watchlistCount, achievement.target);
    case "colecionador":
      return Math.min(state.progressCounts.libraryCount, achievement.target);
    case "pelo-mundo":
      return Math.min(state.progressCounts.countriesCount, achievement.target);
    case "drama-lover":
      return Math.min(state.progressCounts.dramaTitlesCount, achievement.target);
    case "comedia-em-dia":
      return Math.min(state.progressCounts.comedyTitlesCount, achievement.target);
    case "explorador":
      return Math.min(state.progressCounts.genresCount, achievement.target);
    default:
      return 0;
  }
}

/**
 * NOVO (2026-10-16, a pedido — "raridade social" na tela de detalhe:
 * "só X% dos usuários têm isso") — chama `get_achievement_rarity`
 * (migration `20261016000000`), que hoje só calcula pros 4 emblemas
 * piloto (decisão explícita, registrada no plano dos 24: a definição
 * de "usuário elegível" pro denominador dos 24 novos ainda não foi
 * escolhida — fica como está até essa decisão separada). Pros 24
 * novos, `fetchAchievementRarity` simplesmente não devolve entrada
 * nenhuma — a tela de detalhe já trata ausência como "não mostrar o
 * selo de raridade", mesmo comportamento de falha decorativa.
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

/** Quantos emblemas em destaque cabem no card do Perfil — mesmo número usado no mockup aprovado (4 ícones + o "+N"). */
export const MAX_FEATURED_ACHIEVEMENTS = 4;

/**
 * NOVO (2026-10-17, card "Conquistas" de volta pro Perfil — mockup
 * aprovado, 3 cenários) — decisão do usuário via pergunta explícita:
 * os emblemas em destaque no card do Perfil são ESCOLHA MANUAL do
 * usuário (até 4), guardados em `profiles.featured_achievement_ids`
 * (migration `20261017000006`). `null`/coluna vazia = usuário nunca
 * escolheu ainda — nesse caso (e só nesse caso) a tela/card usa como
 * PADRÃO os últimos desbloqueados por data (calculado no cliente a
 * partir de `unlockedAt`, não precisa de função nova no banco).
 *
 * Retorna `null` quando o usuário nunca escolheu (pra quem chama
 * conseguir diferenciar "nunca escolheu" de "escolheu uma lista vazia"
 * — este app não oferece esvaziar a seleção, mas a distinção evita
 * ambiguidade se isso mudar no futuro).
 */
export async function fetchFeaturedAchievementIds(userId: string): Promise<AchievementId[] | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("featured_achievement_ids")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[achievements] Falha ao buscar emblemas em destaque (decorativo — card usa o padrão automático)", error);
    return null;
  }

  const ids = data?.featured_achievement_ids as AchievementId[] | null;
  return ids && ids.length > 0 ? ids : null;
}

/**
 * Grava a escolha manual (sobrescreve a lista inteira — mesmo padrão
 * já usado pelos outros campos editáveis de `profiles`, ex.: `bio`,
 * `display_name`). `ids.length` já deve vir limitado a
 * `MAX_FEATURED_ACHIEVEMENTS` por quem chama (tela de seleção) — esta
 * função não corta a lista sozinha, só grava o que recebe, pra um erro
 * de limite ficar visível na tela em vez de ser escondido aqui.
 */
export async function updateFeaturedAchievementIds(userId: string, ids: AchievementId[]): Promise<boolean> {
  const { error } = await supabase.from("profiles").update({ featured_achievement_ids: ids }).eq("user_id", userId);

  if (error) {
    console.error("[achievements] Falha ao salvar emblemas em destaque", error);
    return false;
  }
  return true;
}

/**
 * Calcula quais emblemas aparecem no card do Perfil: a escolha manual
 * do usuário quando existe; senão, os últimos desbloqueados por data
 * (`unlockedAt` desc), até `MAX_FEATURED_ACHIEVEMENTS` — mesmo
 * critério citado acima. `featuredIds` vem de
 * `fetchFeaturedAchievementIds` (ou `null`); `state` já deve estar
 * carregado (`fetchAchievementsState`). Ids que não existem mais em
 * `ACHIEVEMENTS` (não deveria acontecer, mas um emblema nunca é
 * removido do catálogo) ou que não estão mais desbloqueados são
 * filtrados — nunca mostra um emblema travado aqui, por desenho
 * (pedido explícito: "apenas emblemas que já foram desbloqueado").
 */
export function resolveFeaturedAchievements(
  featuredIds: AchievementId[] | null,
  state: AchievementsState
): AchievementDefinition[] {
  const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

  if (featuredIds && featuredIds.length > 0) {
    return featuredIds
      .map((id) => byId.get(id))
      .filter((a): a is AchievementDefinition => !!a && state.unlocked[a.id])
      .slice(0, MAX_FEATURED_ACHIEVEMENTS);
  }

  return ACHIEVEMENTS.filter((a) => state.unlocked[a.id])
    .sort((a, b) => {
      const dateA = state.unlockedAt[a.id] ?? "";
      const dateB = state.unlockedAt[b.id] ?? "";
      return dateB.localeCompare(dateA);
    })
    .slice(0, MAX_FEATURED_ACHIEVEMENTS);
}
