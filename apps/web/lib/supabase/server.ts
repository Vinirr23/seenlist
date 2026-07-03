import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Cliente Supabase para uso em Server Components, Server Actions e
 * Route Handlers. Lê/escreve a sessão via cookies do Next.js — é o
 * que faz o login persistir entre requisições sem precisar de
 * localStorage/sessionStorage.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // `setAll` chamado de um Server Component (não de uma Server
          // Action/Route Handler) não pode escrever cookies — pode
          // ignorar aqui porque o middleware já cuida de renovar a
          // sessão a cada request.
        }
      },
    },
  });
}
