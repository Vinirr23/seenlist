// TASK-005 pediu "SimilarSeriesCarousel" como componente nomeado;
// TASK-006 pediu "SimilarMoviesCarousel" — ambos são o mesmo carousel
// de pôsteres, só muda o href de destino, que já vem do
// `mediaType` de cada item. Em vez de duplicar o JSX duas vezes,
// os dois nomes reexportam a mesma implementação genérica.
export { SimilarTitlesCarousel as SimilarSeriesCarousel } from "../media/SimilarTitlesCarousel";
