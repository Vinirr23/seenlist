import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * TASK-077 (correção) — cliente com a chave de SERVIÇO (não a anon
 * key), ignora RLS. Só pra rotas de API já protegidas por
 * `env.adminEmail()` (ver `/api/admin/*`) — nunca importar isto num
 * componente ou em qualquer código que rode no navegador. Diferente
 * de `lib/supabase/server.ts`, não usa cookies/sessão — a chave de
 * serviço já é a autorização em si.
 */
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
