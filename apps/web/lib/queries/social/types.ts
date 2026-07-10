import type { MediaType } from "@seenlist/types";

/**
 * TASK-031 — o mesmo "alvo" identifica filme, série, temporada ou
 * episódio, em todas as tabelas sociais (comments/reviews). Nenhuma
 * tabela por tipo de mídia — é exatamente o ponto da arquitetura.
 */
export interface MediaTarget {
  mediaType: MediaType;
  mediaId: number;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

export type LikeTargetType = "comment" | "review" | "list" | "post" | "post_comment";
