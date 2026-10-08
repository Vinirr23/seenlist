import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewRedirect } from "@/components/social/ReviewRedirect";
import { fetchReviewShareCard } from "@/lib/server/reviewShareCard";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social", Fase 1). Rota FINA
 * — não é uma tela nova de review (reviews no site vivem dentro de
 * `/movies/[id]/comments` e `/series/[id]/comments`, ver
 * `ReviewTextSection.tsx`). Esta rota só existe pra:
 * 1. Gerar `generateMetadata`/`opengraph-image.tsx` pro crawler do
 *    WhatsApp/Threads/etc. quando alguém compartilha uma review.
 * 2. Redirecionar uma pessoa de verdade pra onde a review já aparece
 *    de verdade, destacada (`ReviewRedirect.tsx`, no cliente).
 *
 * Review inexistente/removida ou autor não-público: mesma regra do
 * perfil (`u/[username]/page.tsx`) — sem revelar "existe mas é
 * privado", redireciona direto pra home.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}): Promise<Metadata> {
  const { reviewId } = await params;
  const card = await fetchReviewShareCard(reviewId);
  if (!card) return {};

  const title = `Avaliação de ${card.author.displayName} (@${card.author.username}) no SeenList`;
  const description =
    !card.containsSpoiler && card.reviewText
      ? card.reviewText.length > 160
        ? `${card.reviewText.slice(0, 160).trim()}…`
        : card.reviewText
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

export default async function ReviewSharePage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const card = await fetchReviewShareCard(reviewId);
  if (!card) redirect("/");

  const basePath = card.mediaType === "movie" ? "movies" : "series";
  const href = `/${basePath}/${card.mediaId}/comments?highlight=${reviewId}`;

  return <ReviewRedirect href={href} />;
}
