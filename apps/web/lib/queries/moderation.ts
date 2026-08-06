import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A PEDIDO — moderação de denúncias. Achado real: o painel mostrava
 * "1 denúncia" mas não existia NENHUMA tela pra ver do que se trata
 * nem pra agir — a única forma era abrir o Supabase e cruzar UUIDs à
 * mão. A tabela `post_reports` existe desde a fundação do Feed e
 * nunca ganhou interface (registrado como pendência em sessões
 * anteriores).
 *
 * Junta a denúncia com o post e os dois perfis envolvidos (autor e
 * denunciante) numa consulta só — sem isso a tela precisaria de uma
 * consulta por linha (N+1).
 */
export interface ReportedPost {
  reportId: string;
  reason: string;
  reportedAt: string;
  reporterUsername: string | null;
  post: {
    id: string;
    body: string | null;
    imageUrl: string | null;
    type: string;
    mediaTitle: string | null;
    createdAt: string;
    deletedAt: string | null;
    authorUsername: string | null;
    authorName: string | null;
  } | null;
}

export async function fetchReportedPosts(): Promise<ReportedPost[]> {
  const supabase = createAdminClient();

  const { data: reports, error } = await supabase
    .from("post_reports")
    .select("id, post_id, user_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!reports || reports.length === 0) return [];

  const postIds = [...new Set(reports.map((r) => r.post_id))];
  const reporterIds = [...new Set(reports.map((r) => r.user_id))];

  const [postsResult, reportersResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id, user_id, body, image_url, type, media_title, created_at, deleted_at")
      .in("id", postIds),
    supabase.from("profiles").select("id, username").in("id", reporterIds),
  ]);

  const posts = postsResult.data ?? [];
  const authorIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: authors } = await supabase.from("profiles").select("id, username, display_name").in("id", authorIds);

  const postById = new Map(posts.map((p) => [p.id, p]));
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));
  const reporterById = new Map((reportersResult.data ?? []).map((r) => [r.id, r]));

  return reports.map((report) => {
    const post = postById.get(report.post_id);
    const author = post ? authorById.get(post.user_id) : null;

    return {
      reportId: report.id,
      reason: report.reason,
      reportedAt: report.created_at,
      reporterUsername: reporterById.get(report.user_id)?.username ?? null,
      post: post
        ? {
            id: post.id,
            body: post.body,
            imageUrl: post.image_url,
            type: post.type,
            mediaTitle: post.media_title,
            createdAt: post.created_at,
            deletedAt: post.deleted_at,
            authorUsername: author?.username ?? null,
            authorName: author?.display_name ?? null,
          }
        : null,
    };
  });
}
