/**
 * Barrel — mantém `@/lib/queries/watched-episodes` funcionando pros
 * consumidores existentes (SeasonAccordion, SeriesDetailsView) depois
 * que o arquivo foi dividido em leitura (watched-episodes-state) e
 * escrita (watched-episodes-mutations) na revisão de estabilização
 * (TASK-007A), mesmo padrão já aplicado em lib/queries/library.ts.
 */
export * from "./watched-episodes-state";
export * from "./watched-episodes-mutations";
