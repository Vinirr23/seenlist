import type { Metadata } from "next";
import { PostDetailView } from "@/components/explore/PostDetailView";
import { fetchPostShareCard } from "@/lib/server/postShareCard";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social" — extensão pedida
 * depois de testar a Fase 1: "ao compartilhar uma avaliação publicada
 * no Feed, o link /explore/posts/[id] aparece sem prévia visual
 * personalizada"). Mesmo padrão de `app/r/[reviewId]/page.tsx` (ler
 * aquele arquivo primeiro): só `generateMetadata` é novo aqui — a
 * página em si NÃO é uma rota fina/redirect como a de review, ela já
 * é a tela real do post (`PostDetailView`), então o `export default`
 * permanece como estava.
 *
 * Post que não é do tipo "review", post removido, ou autor
 * não-público: `fetchPostShareCard` devolve `null` e `generateMetadata`
 * devolve `{}` — Next então usa os metadados padrão do layout (sem
 * título/imagem personalizados), nunca expõe nada que deveria ficar
 * oculto.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = await fetchPostShareCard(id);
  if (!card) return {};

  const title = `${card.author.displayName} (@${card.author.username}) no SeenList`;
  const description = card.body
    ? card.body.length > 160
      ? `${card.body.slice(0, 160).trim()}…`
      : card.body
    : card.mediaTitle
      ? `Avaliação de ${card.mediaTitle} no SeenList.`
      : "Organize filmes, séries e animes no SeenList.";

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetailView postId={id} />;
}
