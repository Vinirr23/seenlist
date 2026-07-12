import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de redirect do Google OAuth, da confirmação de cadastro por
 * e-mail e do link de recuperação de senha — todos passam por aqui pra
 * trocar o `code` por uma sessão antes de seguir. Não é uma "tela"
 * (sem UI própria), é o encanamento que o @supabase/ssr exige pra
 * esses três fluxos funcionarem no App Router.
 *
 * TASK-079 — `?mobile=1` (colocado por `signInWithGoogle` quando
 * detecta o User-Agent do app) muda o destino final: em vez de um
 * redirect normal dentro do mesmo navegador (que é como o fluxo web
 * sempre funcionou), manda pro esquema customizado do app
 * (`seenlist://auth-bridge`) carregando os tokens da sessão — é
 * assim que o app nativo (que abriu esse login numa aba de navegador
 * externa, não na própria WebView, justamente pra escapar do bloqueio
 * do Google) recebe de volta o resultado e consegue logar a WebView
 * interna dele (ver `/auth/mobile-bridge`, o próximo passo dessa
 * ponte, e `apps/mobile/app/index.tsx`).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const isMobileApp = searchParams.get("mobile") === "1";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (isMobileApp && data.session) {
        const bridgeUrl = new URL("seenlist://auth-bridge");
        bridgeUrl.searchParams.set("access_token", data.session.access_token);
        bridgeUrl.searchParams.set("refresh_token", data.session.refresh_token);
        return NextResponse.redirect(bridgeUrl.toString());
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] Falha ao trocar o código por sessão.", error);
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
