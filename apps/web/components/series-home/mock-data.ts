/**
 * TASK-016A: os cards desta tela precisam ser clicáveis e levar a
 * uma série de verdade (senão a funcionalidade de progresso de
 * episódios, que já funciona em /series/[id], fica inalcançável a
 * partir da navegação principal). Os "dados mockados" aqui são só o
 * *status* (em que lista o item está, progresso) — os `id`/`title`
 * são de séries reais do TMDB (confirmados via busca), pra cada
 * card linkar pra uma página de série que carrega de verdade.
 * Continua sem nenhuma chamada ao TMDB aqui nesta tela (só o `id`
 * está hardcoded) — quem busca os dados de verdade é a página de
 * destino, /series/[id], como já fazia antes.
 */
export interface MockSeries {
  /** id real do TMDB — clicar no card abre a série de verdade. */
  id: number;
  title: string;
  year: number;
  /** 0–100, só preenchido para "Continue assistindo". */
  progress?: number;
}

export const continueAssistindo: MockSeries[] = [
  { id: 60625, title: "Rick and Morty", year: 2013, progress: 62 },
  { id: 1396, title: "Breaking Bad", year: 2008, progress: 40 },
  { id: 66732, title: "Stranger Things", year: 2016, progress: 85 },
  { id: 2316, title: "The Office", year: 2005, progress: 20 },
];

export const assistindo: MockSeries[] = [
  { id: 48891, title: "Brooklyn Nine-Nine", year: 2013 },
  { id: 82856, title: "The Mandalorian", year: 2019 },
  { id: 60625, title: "Rick and Morty", year: 2013 },
  { id: 1396, title: "Breaking Bad", year: 2008 },
  { id: 66732, title: "Stranger Things", year: 2016 },
];

export const assistirDepois: MockSeries[] = [
  { id: 2316, title: "The Office", year: 2005 },
  { id: 48891, title: "Brooklyn Nine-Nine", year: 2013 },
  { id: 82856, title: "The Mandalorian", year: 2019 },
  { id: 60625, title: "Rick and Morty", year: 2013 },
  { id: 1396, title: "Breaking Bad", year: 2008 },
  { id: 66732, title: "Stranger Things", year: 2016 },
];

export const concluidas: MockSeries[] = [
  { id: 2316, title: "The Office", year: 2005 },
  { id: 48891, title: "Brooklyn Nine-Nine", year: 2013 },
  { id: 82856, title: "The Mandalorian", year: 2019 },
  { id: 1396, title: "Breaking Bad", year: 2008 },
];

export const recomendadas: MockSeries[] = [
  { id: 66732, title: "Stranger Things", year: 2016 },
  { id: 60625, title: "Rick and Morty", year: 2013 },
  { id: 2316, title: "The Office", year: 2005 },
  { id: 48891, title: "Brooklyn Nine-Nine", year: 2013 },
  { id: 82856, title: "The Mandalorian", year: 2019 },
];
