import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/LandingPage";

/**
 * CORREÇÃO (2026-09-04, a pedido — "ao entrar no link, vai direto pra
 * a pagina de login, quero que vá pra uma pagina, onde o usuário
 * entenda sobre o que é o app") — "/" redirecionava pra "/series" sem
 * checar sessão nenhuma; quem não tinha sessão nunca via essa tela de
 * verdade, porque o `middleware.ts` já intercept(av)ava "/" antes
 * (não estava em `PUBLIC_ROUTES`) e mandava direto pra "/login" — daí
 * o sintoma "vai direto pra login". Duas partes da correção: "/" virou
 * rota pública no middleware, e aqui o redirect só acontece quando HÁ
 * sessão de verdade (mesmo cliente Supabase de server usado no resto
 * do app, `lib/supabase/server.ts`) — sem sessão, renderiza a landing
 * page (`components/landing/LandingPage.tsx`) em vez de redirecionar
 * às cegas.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/series");
  }

  return <LandingPage />;
}
