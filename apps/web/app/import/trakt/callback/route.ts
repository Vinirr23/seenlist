import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeTraktCode } from "@/lib/trakt/client";

/**
 * TASK-171 — o Trakt redireciona pra cá depois do usuário autorizar,
 * com um `?code=...` de uso único. Troca esse código pelo token de
 * acesso (aqui, no servidor — o `client_secret` nunca sai daqui) e
 * guarda o token num cookie **httpOnly** (JavaScript do navegador
 * não consegue ler isso, só o servidor) e de curta duração (15
 * minutos — tempo de sobra pra terminar o assistente de importação;
 * depois disso expira sozinho). Como esta importação é única (não
 * fica sincronizando), não existe motivo pra guardar o token de
 * verdade em lugar nenhum — some assim que o cookie expira.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/import/trakt?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/import/trakt?error=sem_codigo`);
  }

  try {
    const accessToken = await exchangeTraktCode(code);
    const cookieStore = await cookies();
    cookieStore.set("trakt_access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });
    return NextResponse.redirect(`${origin}/import/trakt?connected=1`);
  } catch (err) {
    console.error("[trakt/callback] Falha ao trocar código por token", err);
    return NextResponse.redirect(`${origin}/import/trakt?error=falha_autenticacao`);
  }
}
