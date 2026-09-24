import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LandingPage from "@/components/landing/LandingPage";

/**
 * REVISÃO DE METADADOS (2026-09-16) — canonical da home movido de
 * `app/layout.tsx` (onde era fixo e "vazava" como canonical padrão de
 * QUALQUER página-filha sem o dela próprio) pra cá. Título e descrição
 * continuam vindo do layout de propósito — a home não os sobrescreve,
 * então herda "SeenList — Organize séries e filmes" normalmente, sem
 * precisar duplicar esse texto aqui.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

/**
 * SEO — dado estruturado (JSON-LD, schema.org "SoftwareApplication",
 * 2026-09-04, a pedido — "preciso que o app ranqueie nas pesquisas do
 * Google") — isto é o que dá ao Google (inclusive à IA por trás da
 * "Visão geral criada por IA") um jeito de ENTENDER, de forma
 * estruturada, que "SeenList" = este site = este app, com links de
 * download de verdade — em vez de só adivinhar a partir de texto
 * solto. Sem isso, o Google não tinha nenhuma fonte estruturada
 * apontando pro SeenList de verdade, só a fonte não-estruturada que
 * ele já achou (o app "SeenList: Track Shows & Movies" de outro
 * desenvolvedor — Mustafa Nur Kanli, o mesmo do aviso de marca
 * registrada da Apple — na App Store, sem nenhuma ligação com este
 * projeto).
 *
 * REVISÃO (2026-09-24, a pedido) — app iOS ("SeenList: Séries e
 * Filmes", App ID 6812850654) confirmado publicado de verdade na App
 * Store (confirmado por instalação de terceiro, não só pela ficha
 * pública — o Connect ainda mostrava "Ready for Distribution"
 * desatualizado no momento desta mudança). Virou DOIS objetos
 * `SoftwareApplication` (um por loja, cada um com seu próprio `@id`,
 * `operatingSystem`, `offers.priceCurrency` e `downloadUrl`) em vez de
 * um `operatingSystem` combinado — é o formato que o Google recomenda
 * pra apps multiplataforma, permite cada loja ter seu preço/moeda
 * corretos, e evita reintroduzir o mesmo tipo de dado ambíguo que
 * causava a confusão com o Seenr.
 *
 * Sem `aggregateRating`/`review` de propósito também — o SeenList
 * ainda não tem avaliação nenhuma nas lojas; inventar uma nota
 * violaria as diretrizes do schema.org e da Busca do Google (dado
 * estruturado tem que refletir o que existe de verdade na página/no
 * app).
 */
const SHARED_APP_FIELDS = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SeenList",
  url: "https://seenlist.app",
  // `image` aponta pro logo oficial já servido em `public/logo.png`
  // (mesmo arquivo usado no <Header> — ver
  // `components/landing/shared.tsx` — e nos ícones do app) — URL
  // absoluta porque JSON-LD não resolve caminho relativo contra
  // `metadataBase` como o resto do `Metadata` da página resolve.
  image: "https://seenlist.app/logo.png",
  description: "Acompanhe episódio por episódio, avalie séries e filmes, escreva resenhas, monte listas e siga amigos — tudo num só lugar.",
  applicationCategory: "EntertainmentApplication",
} as const;

const ANDROID_APP_JSON_LD = {
  ...SHARED_APP_FIELDS,
  "@id": "https://seenlist.app/#app-android",
  operatingSystem: "ANDROID",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BRL",
  },
  downloadUrl: "https://play.google.com/store/apps/details?id=com.seenlist.app",
};

const IOS_APP_JSON_LD = {
  ...SHARED_APP_FIELDS,
  "@id": "https://seenlist.app/#app-ios",
  operatingSystem: "IOS",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  downloadUrl: "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ANDROID_APP_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- JSON.stringify de um objeto literal fixo aqui em cima, não de dado de usuário/externo — nada pra sanitizar.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(IOS_APP_JSON_LD) }}
      />
      <LandingPage />
    </>
  );
}
