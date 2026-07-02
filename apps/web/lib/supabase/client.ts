import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para uso em Client Components. Só é necessário
 * onde precisamos escutar mudanças de sessão no browser (ex.: detectar
 * a sessão de recuperação de senha em /forgot-password). O resto do
 * fluxo de auth roda via Server Actions com o cliente de server.ts.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
