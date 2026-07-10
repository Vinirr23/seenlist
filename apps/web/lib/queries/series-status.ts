/**
 * Barrel — mesmo padrão de movie-status.ts / watched-episodes.ts /
 * library.ts: leitura (series-status-state) e escrita
 * (series-status-mutations) separadas, reexportadas juntas aqui.
 */
export * from "./series-status-state";
export * from "./series-status-mutations";
