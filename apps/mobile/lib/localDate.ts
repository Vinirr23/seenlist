/**
 * TASK-154 (correção — badge "NOVO" vs "EM BREVE" divergindo entre
 * aparelhos) — causa raiz real: várias partes do código calculavam
 * "hoje" com `new Date().toISOString().slice(0, 10)`, que usa o
 * fuso UTC, não o fuso local do aparelho. Pra quem está no fuso do
 * Brasil (UTC-3), isso faz o "hoje" virar o dia seguinte já a
 * partir das 21h locais — um episódio que só sai amanhã de verdade
 * (hora local) passava a contar como "já saiu" nessas contas, mas
 * `computeBadge` (em upcomingEpisodes.ts) já usava a data local
 * corretamente — daí o mesmo episódio aparecer como "já saiu" numa
 * conta e "ainda não saiu" na outra, ao mesmo tempo, no mesmo
 * aparelho. Esta função usa `getFullYear`/`getMonth`/`getDate`
 * (sempre fuso local, nunca UTC) — usada em todo lugar que precisa
 * comparar uma data (formato TMDB, YYYY-MM-DD) contra "hoje".
 */
export function todayLocalKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * TASK-154 — mesma correção, pra extrair a data LOCAL (não UTC) de
 * qualquer timestamp — usada em `episodesTimeline.ts`, que agregava
 * "quando você assistiu" usando `.toISOString()` num timestamp
 * (UTC), fazendo episódios assistidos à noite (fuso do Brasil)
 * contarem pro dia seguinte no gráfico.
 */
export function localDateKeyFrom(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
