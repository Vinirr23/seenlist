import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { AdminRepairSeriesView } from "@/components/admin/AdminRepairSeriesView";

/**
 * TASK-175 — mesma checagem "de verdade" de `/admin/invite`: Server
 * Component, roda no servidor, nunca expõe `env.adminEmail()` ao
 * navegador. A rota de API por trás (`/api/admin/repair-series-
 * categories`) faz a MESMA checagem de novo.
 */
export default async function AdminRepairSeriesPage() {
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

  return <AdminRepairSeriesView />;
}
