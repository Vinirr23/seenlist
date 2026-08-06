import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { fetchObservabilityMetrics } from "@/lib/queries/observability";
import { ObservabilityView } from "@/components/admin/ObservabilityView";

/**
 * A PEDIDO — dashboard de observabilidade, só pro dono do projeto.
 * Mesma checagem de `/admin/invite`: Server Component, roda no
 * servidor, nunca expõe `env.adminEmail()` ao navegador.
 *
 * Diferente das outras páginas de admin, esta não tem rota de API
 * por trás — a coleta acontece aqui mesmo, no servidor, e só os
 * números prontos chegam ao navegador. Ninguém sem acesso consegue
 * disparar consulta nenhuma.
 */
export const dynamic = "force-dynamic";

export default async function AdminObservabilityPage() {
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

  const metrics = await fetchObservabilityMetrics();

  return <ObservabilityView metrics={metrics} />;
}
