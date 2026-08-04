"use client";

import { useReviewAggregate } from "@/lib/queries/social/reviews";
import { ReviewSummary } from "./ReviewSummary";

export interface ReviewsSectionProps {
  target: import("@/lib/queries/social/types").MediaTarget;
}

/**
 * A PEDIDO (revertendo uma decisão anterior — "não gostei, deixa
 * prático") — essa seção (aba Sobre) volta a ser só o RESUMO da
 * comunidade (nota média + distribuição), sem nada pra preencher.
 * Dar nota, escrever texto, "contém spoiler" e "publicar no Feed"
 * moraram aqui antes, depois só o texto foi pra outra tela — agora
 * TUDO isso vive junto em "Ver todas as avaliações"
 * (`ReviewFullComposer.tsx` + `ReviewTextSection.tsx`), pra evitar a
 * avaliação ficar espalhada em duas telas diferentes.
 */
export function ReviewsSection({ target }: ReviewsSectionProps) {
  const { data: aggregate } = useReviewAggregate(target);

  if (!aggregate) return null;

  return <ReviewSummary aggregate={aggregate} />;
}
