import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/LandingPage";

/**
 * SEO — dado estruturado (JSON-LD, schema.org "SoftwareApplication",
 * 2026-09-04, a pedido — "preciso que o app ranqueie nas pesquisas do
 * Google") — isto é o que dá ao Google (inclusive à IA por trás da
 * "Visão geral criada por IA") um jeito de ENTENDER, de forma
 * estruturada, que "SeenList" = este site = este app, com um link de
 * download de verdade — em vez de só adivinhar a partir de texto
 * solto. Sem isso, o Google não tinha nenhuma fonte estruturada
 * apontando pro SeenList de verdade, só a fonte não-estruturada que
 * ele já achou (o app "SeenList: Track Shows & Movies" de outro
 * desenvolvedor na App Store, sem nenhuma ligação com este projeto).
 *
 * `operatingSystem` lista só "ANDROID" DE PROPÓSITO — o app ainda não
 * está na App Store (só na Play Store, confirmado com o usuário em
 * 2026-09-04). Assim que sair na App Store, adicionar "IOS" aqui e um
 * segundo item em `offers`/`downloadUrl` com o link real da Apple —
 * NUNCA inventar/adiantar isso, dado estruturado errado é pior do que
 * nenhum (o Google pode penalizar por informação enganosa).
 *
 * Sem `aggregateRating`/`review` de propósito também — o SeenList
 * ainda não tem avaliação nenhuma nas lojas; inventar uma nota
 * violaria as diretrizes do schema.org e da Busca do Google (dado
 * estruturado tem que refletir o que existe de verdade na página/no
 * app).
 */
const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SeenList",
  url: "https://seenlist.app",
  description: "Acompanhe episódio por episódio, avalie séries e filmes, escreva resenhas, monte listas e siga amigos — tudo num só lugar.",
  applicationCategory: "EntertainmentApplication",
  operatingSystem: "ANDROID",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
  },
  downloadUrl: "https://play.google.com/store/apps/details?id=com.seenlist.app",
};

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

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON.stringify de um objeto literal fixo aqui em cima, não de dado de usuário/externo — nada pra sanitizar.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <LandingPage />
    </>
  );
}
