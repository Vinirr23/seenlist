import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de redirect do Google OAuth, da confirmação de cadastro por
 * e-mail e do link de recuperação de senha — todos passam por aqui pra
 * trocar o `code` por uma sessão antes de seguir. Não é uma "tela"
 * (sem UI própria), é o encanamento que o @supabase/ssr exige pra
 * esses três fluxos funcionarem no App Router.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] Falha ao trocar o código por sessão.", error);
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
