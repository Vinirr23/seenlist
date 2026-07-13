import { supabase } from "@/lib/supabase";

export interface SocialCounts {
  commentsGiven: number;
  reviewsGiven: number;
  likesGiven: number;
}

/** Idêntico a social-counts.ts do web — dado real (a versão nativa anterior mostrava "Comentários" sempre fixo em 0). */
export async function fetchSocialCounts(userId: string): Promise<SocialCounts> {
  const [comments, reviews, likes] = await Promise.all([
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
    supabase.from("reviews").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
    supabase.from("likes").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    commentsGiven: comments.count ?? 0,
    reviewsGiven: reviews.count ?? 0,
    likesGiven: likes.count ?? 0,
  };
}
