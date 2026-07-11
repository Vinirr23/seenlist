import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { AdminInviteView } from "@/components/admin/AdminInviteView";

/**
 * TASK-077 — checagem "de verdade" (Server Component, roda no
 * servidor, nunca expõe `env.adminEmail()` ao navegador). Quem não é
 * o dono do projeto vê só esta mensagem — a rota de API por trás do
 * formulário (`/api/admin/send-beta-invite`) faz a MESMA checagem de
 * novo, então mesmo alguém descobrindo o link direto de
 * `AdminInviteView` sem passar por aqui não conseguiria disparar
 * nada.
 */
export default async function AdminInvitePage() {
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

  return <AdminInviteView />;
}
