import { supabase, getCurrentAuthUser } from "@/lib/supabase";

/** Idêntico a useReportPost do web — erro de violação de unicidade (já denunciou antes) não é tratado como falha. */
export async function reportPost(postId: string, reason: string): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  const { error } = await supabase.from("post_reports").insert({ post_id: postId, user_id: user.id, reason });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}
