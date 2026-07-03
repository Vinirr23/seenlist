/**
 * Barrel — mesma razão de watched-episodes.ts e library.ts: mantém
 * `@/lib/queries/movie-status` funcionando pros consumidores
 * existentes (MovieActions) depois do arquivo dividido em leitura
 * (movie-status-state) e escrita (movie-status-mutations).
 */
export * from "./movie-status-state";
export * from "./movie-status-mutations";
