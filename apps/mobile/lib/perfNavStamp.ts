/**
 * DIAGNÓSTICO TEMPORÁRIO (2026-09-17 — "tem um delay na mudança de
 * abas quando aperto na barra de navegação"). Mede o tempo real entre
 * o toque na barra (`DockNavegacao.tsx`, `handlePress`) e o momento em
 * que a tela de destino GANHA FOCO de verdade (`useFocusEffect`, não
 * só monta — abas do `expo-router` ficam montadas depois da 1ª visita,
 * então "montar" só aconteceria na primeira troca).
 *
 * REMOVER junto com os `console.log` de `[PERF-DOCK]` espalhados nas 4
 * telas de aba e em `DockNavegacao.tsx`, depois que a causa raiz do
 * delay for encontrada e corrigida.
 */
let ultimoToqueEm = 0;

export function marcarToqueNaAba() {
  ultimoToqueEm = performance.now();
}

export function logTempoDesdeOToque(nomeDaTela: string) {
  if (ultimoToqueEm === 0) return;
  const agora = performance.now();
  console.log(`[PERF-DOCK] ${nomeDaTela} ganhou foco ${(agora - ultimoToqueEm).toFixed(1)}ms depois do toque na barra`);
  ultimoToqueEm = 0;
}
