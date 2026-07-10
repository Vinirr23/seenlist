export interface MovieCategoryResult {
  status: "watched" | "want_to_watch";
  reason: string;
}

/**
 * Filmes não têm o conceito de "em dia"/"pausado" — só assistido ou
 * não, direto do campo `is_watched` do arquivo. Sem promoção
 * automática nenhuma (não existe "a série terminou" pra um filme
 * único).
 */
export function resolveMovieCategory(isWatched: boolean): MovieCategoryResult {
  return isWatched
    ? { status: "watched", reason: "Arquivo marca is_watched=true." }
    : { status: "want_to_watch", reason: "Arquivo marca is_watched=false." };
}
