import { notFound } from "next/navigation";
import { GenreAllView } from "@/components/explore/GenreAllView";

/**
 * Fase C da reformulação da Explorar (2026-08-21) — rota dinâmica
 * pros chips de "Seus gêneros favoritos" (`GenreChips.tsx`), no
 * mesmo padrão de `/explore/all-movies` e `/explore/all-series`
 * (page.tsx fino, só repassa pro componente real). `mediaType` vem da
 * própria URL (só os links que a gente mesmo gera apontam pra cá) —
 * ainda assim valida antes de confiar, em vez de assumir.
 *
 * CORREÇÃO (bug real, `pnpm typecheck` reportado pelo usuário —
 * "Type '{ mediaType: string; genreId: string; }' does not satisfy
 * the constraint 'PageProps'... missing Promise") — Next.js 15.5.18
 * (versão deste projeto) exige `params` como `Promise`, não objeto
 * direto, em toda página do App Router; esta página tinha ficado com
 * o formato antigo. Mesmo padrão já usado (correto) em
 * `movies/[id]/page.tsx`, `series/[id]/page.tsx`, `u/[username]/page.tsx`
 * e `explore/similar/[mediaType]/[anchorId]/page.tsx` (Fase D).
 */
export default async function GenrePage({
  params,
}: {
  params: Promise<{ mediaType: string; genreId: string }>;
}) {
  const { mediaType, genreId } = await params;
  if (mediaType !== "movie" && mediaType !== "series") notFound();

  const parsedGenreId = Number(genreId);
  if (!Number.isInteger(parsedGenreId) || parsedGenreId <= 0) notFound();

  return <GenreAllView mediaType={mediaType} genreId={parsedGenreId} />;
}
