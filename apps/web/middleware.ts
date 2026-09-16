import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto assets estáticos do Next, arquivos com
     * extensão (imagens, favicon etc.) e as rotas de metadata geradas
     * pelo Next (app/sitemap.ts, app/robots.ts) — não precisam passar
     * por checagem de sessão.
     *
     * BUG REAL CORRIGIDO (2026-09-16, achado pelo Search Console —
     * "O sitemap está em HTML") — sitemap.xml e robots.txt NÃO tinham
     * extensão nem caminho excluído aqui, então caíam na checagem de
     * sessão do updateSession() (lib/supabase/middleware.ts) igual
     * qualquer rota privada. Quem tem cookie de sessão (qualquer
     * pessoa logada testando no navegador) nem percebia: via o XML
     * normal. Mas o Googlebot (e qualquer visitante sem cookie) nunca
     * tem sessão — era redirecionado pra "/login" e recebia o HTML da
     * tela de login no lugar do XML/texto, confirmado em produção via
     * `curl.exe` sem cookies: 307 Temporary Redirect, Location:
     * /login?redirectTo=%2Fsitemap.xml (e o mesmo pra /robots.txt).
     * Excluir aqui, no matcher, em vez de só adicionar em
     * PUBLIC_ROUTES, também evita a consulta ao Supabase
     * (`supabase.auth.getUser()`) nessas duas rotas — elas não
     * precisam de sessão nenhuma pra existir.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
