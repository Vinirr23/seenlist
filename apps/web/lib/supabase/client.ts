import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente Supabase para uso em Client Components. Só é necessário
 * onde precisamos escutar mudanças de sessão no browser (ex.: detectar
 * a sessão de recuperação de senha em /forgot-password). O resto do
 * fluxo de auth roda via Server Actions com o cliente de server.ts.
 */
export function createClient() {
  return createBrowserClient(env.supabaseUrl(), env.supabaseAnonKey());
}

/**
 * AUDITORIA (achado real, mesmo padrão já corrigido no mobile em 25
 * arquivos, `getCurrentAuthUser()` de `apps/mobile/lib/supabase.ts`)
 * — `supabase.auth.getUser()` faz uma chamada de REDE de verdade pro
 * servidor de Auth do Supabase (é assim que ele revalida a sessão).
 * `getSession()` lê do armazenamento local, sem rede. No client
 * (browser), pedir só "quem está logado agora, pra passar o id numa
 * query" não precisa dessa revalidação — a segurança de verdade é o
 * RLS do Postgres, que roda de qualquer forma em cima do JWT
 * assinado, não dessa checagem extra. Usar isto em vez de
 * `supabase.auth.getUser()` nos hooks/mutations de `lib/queries/`
 * evita uma chamada de rede redundante por hook, multiplicada por
 * quantos componentes estiverem montados ao mesmo tempo (ex.: Feed
 * com vários `PostCard`, cada um com vários hooks sociais).
 *
 * NÃO usar isto no server (middleware, Server Actions, rotas de
 * API) — lá `getUser()` é o padrão certo e recomendado pelo próprio
 * Supabase, porque só ele valida a assinatura do JWT contra o
 * servidor (`getSession()` no server confia no cookie sem
 * revalidar, o que é um risco de segurança fora do browser).
 */
export async function getCurrentAuthUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null }, error };
}
