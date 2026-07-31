/**
 * AUDITORIA (perf) — o `QueryClient` (app/providers.tsx) tem um
 * `staleTime` GLOBAL de 30s pra tudo. Isso já resolve o problema
 * mais grave (padrão do React Query é 0 — toda troca de foco de
 * aba refaz TODAS as consultas), mas trata dado que quase nunca
 * muda (perfil, contagem de seguidores) igual a dado que muda o
 * tempo todo (Feed, atividade). Essas constantes deixam explícito,
 * consulta por consulta, o motivo de cada prazo escolhido — sem
 * precisar decorar "quantos milissegundos são 5 minutos" em cada
 * arquivo.
 */

/** Perfil, contagens de seguidores, preferências — muda raramente, e mesmo desatualizado por alguns minutos não é grave. */
export const STALE_TIME_PROFILE = 5 * 60 * 1000;

/** Biblioteca, detalhes de série/filme, favoritos, listas — muda com uso ativo (marcar episódio, favoritar), mas não a cada segundo. */
export const STALE_TIME_LIBRARY = 2 * 60 * 1000;

/** Comentários, reviews, curtidas — conversa em andamento, mas o padrão global de 30s já é adequado (mantido explícito aqui só pra documentar a decisão, não fica sem cobertura). */
export const STALE_TIME_SOCIAL = 30 * 1000;

/** Feed e atividade de quem você segue — o que mais se espera "fresco" no app; mais curto que o padrão global. */
export const STALE_TIME_FEED = 15 * 1000;
