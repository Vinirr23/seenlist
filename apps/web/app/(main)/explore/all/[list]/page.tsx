import { notFound } from "next/navigation";
import { DiscoverAllView } from "@/components/explore/DiscoverAllView";
import type { DiscoverListKey } from "@/lib/queries/discover";

const VALID_LISTS: DiscoverListKey[] = [
  "trending_series",
  "trending_movies",
  "popular_series",
  "popular_movies",
  "upcoming_movies",
  "on_the_air_series",
];

/**
 * A pedido — "adiciona nos demais, essa seta > que tem em 'Em alta
 * agora'". As outras listas (Chegando em breve, Novas séries,
 * Populares) não tinham NENHUMA página "ver todos" própria ainda —
 * só existiam `/explore/all-movies` e `/explore/all-series`
 * (`popular_movies`/`popular_series` fixos, herdados de antes da
 * reformulação). Rota dinâmica única pra qualquer uma das 6 listas
 * fixas, em vez de criar uma pasta por lista.
 *
 * CORREÇÃO junto (achado real, ao mexer nisso) — a seta de "Em alta
 * agora" apontava pra `/explore/all-movies`/`all-series`, que sempre
 * mostrou `popular_movies`/`popular_series` — ou seja, clicar na seta
 * de "Em alta agora" (trending) abria uma tela de "populares", dado
 * DIFERENTE do carrossel de onde você clicou. Agora cada seta vai
 * pra sua própria lista (`/explore/all/trending_movies` etc.) — sem
 * mais esse descompasso. As rotas antigas continuam existindo (não
 * apagadas), só ninguém mais aponta pra elas.
 *
 * CORREÇÃO (achado ao investigar o erro real de `explore/genre/
 * [mediaType]/[genreId]/page.tsx`, mesma causa raiz — Next.js 15.5.18
 * exige `params` como `Promise` em toda página do App Router). Esta
 * página tinha o MESMO formato antigo (objeto direto), só que ainda
 * não tinha aparecido no `pnpm typecheck` porque o Next só gera o
 * arquivo de tipo de uma rota depois dela ser visitada/compilada pelo
 * menos uma vez — ia quebrar do mesmo jeito assim que isso
 * acontecesse. Mesmo padrão certo de `movies/[id]/page.tsx` etc.
 */
export default async function ExploreAllListPage({
  params,
}: {
  params: Promise<{ list: string }>;
}) {
  const { list } = await params;
  if (!VALID_LISTS.includes(list as DiscoverListKey)) notFound();

  return <DiscoverAllView list={list as DiscoverListKey} />;
}
