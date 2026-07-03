/**
 * Barrel — mantém `@/lib/queries/library` funcionando pros
 * consumidores existentes (LibraryView, LibraryCard) depois que o
 * arquivo foi dividido em leitura (library-state) e escrita
 * (library-mutations) na revisão de estabilização (TASK-007A).
 */
export * from "./library-state";
export * from "./library-mutations";
