import { notFound } from "next/navigation";
import { SimilarAllView } from "@/components/explore/SimilarAllView";

/**
 * Fase D da reformulação da Explorar (2026-08-22) — rota "ver todos"
 * do carrossel "Porque você assistiu a [X]" (page.tsx fino, só valida
 * a URL e repassa pro componente real). `mediaType`/`anchorId` vêm da
 * própria URL (só os links que a gente mesmo gera — `ExploreMoviesTab`/
 * `ExploreSeriesTab` — apontam pra cá); `?title=` também, ver
 * comentário completo em `SimilarAllView.tsx` sobre por que o título
 * não é recalculado aqui.
 *
 * CORREÇÃO (achado ao rodar `pnpm typecheck` de verdade, reportado
 * pelo usuário — Next.js 15.5.18 exige `params`/`searchParams` como
 * `Promise`, não objeto direto, em toda página do App Router; ver
 * `movies/[id]/page.tsx`/`series/[id]/page.tsx`/`u/[username]/page.tsx`,
 * que já usam esse padrão certo). A PRIMEIRA versão desta rota nova
 * tinha copiado, por engano, o padrão ANTIGO (objeto direto) de
 * `explore/genre/[mediaType]/[genreId]/page.tsx` e `explore/all/[list]/
 * page.tsx` — 2 páginas pré-existentes já identificadas (sessão
 * anterior) como tendo esse mesmo erro de typecheck, só que fora do
 * escopo daquele trabalho pra corrigir sem ser pedido. Como esta
 * página é CÓDIGO NOVO desta sessão (não um bug pré-existente alheio),
 * corrigido direto pro padrão certo — não faz sentido introduzir de
 * propósito um bug já conhecido.
 */
export default async function SimilarPage({
  params,
  searchParams,
}: {
  params: Promise<{ mediaType: string; anchorId: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const { mediaType, anchorId } = await params;
  if (mediaType !== "movie" && mediaType !== "series") notFound();

  const parsedAnchorId = Number(anchorId);
  if (!Number.isInteger(parsedAnchorId) || parsedAnchorId <= 0) notFound();

  const { title } = await searchParams;
  return <SimilarAllView mediaType={mediaType} anchorId={parsedAnchorId} anchorTitle={title ?? null} />;
}
