import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { fetchReportedPosts } from "@/lib/queries/moderation";
import { ModerationView } from "@/components/admin/ModerationView";

/** A PEDIDO — moderação de denúncias, só pro dono. Mesma checagem das outras páginas de admin. */
export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== env.adminEmail()) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-center md:mx-auto md:max-w-[430px]">
        <p className="text-sm text-muted">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  const reports = await fetchReportedPosts();

  return <ModerationView reports={reports} />;
}
