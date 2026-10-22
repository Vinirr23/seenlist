import type { Metadata } from "next";
import Link from "next/link";
import { Tv, Star, Users } from "lucide-react";
import {
  GLASS_CARD,
  GLASS_CARD_BG,
  GLASS_CHIP,
  GLASS_CHIP_BG,
  Header,
  Footer,
  StoreBadges,
} from "@/components/landing/shared";

/**
 * FASE 2 (2026-10-21, a pedido — "criar uma página simples de
 * disponibilidade/download do aplicativo") — nova página pública
 * "/download", mesmo padrão visual de `/about` (reaproveita
 * Header/Footer/GLASS_CARD/StoreBadges de `shared.tsx`, sem inventar
 * nenhum componente novo). Objetivo único desta página: dar um lugar
 * estável e direto pra mandar alguém que só precisa dos links de loja
 * — hoje esses links só existem espalhados dentro de `LandingPage.tsx`
 * (rodapé/CTAs) e no rodapé de `/about`. Isso importa especialmente
 * pra Fase 2: quando a web deixar de ter cadastro/login completos,
 * "/download" é o destino natural pra onde redirecionar links antigos
 * que hoje levam pra funcionalidades que vão sair do ar.
 *
 * NÃO decidido aqui sozinho: ainda não entrou em `PUBLIC_ROUTES`
 * (`lib/supabase/middleware.ts`) nem em `sitemap.ts`/`robots.ts` —
 * isso é alteração de roteamento/indexação, fora do que foi autorizado
 * nesta etapa ("não remova rotas existentes ainda", nada foi pedido
 * sobre ADICIONAR uma rota ao middleware). Ver aviso na auditoria.
 */
const DOWNLOAD_TITLE = "Baixe o SeenList";
const DOWNLOAD_DESCRIPTION =
  "Baixe o SeenList gratuitamente na App Store ou no Google Play e comece a acompanhar episódio por episódio.";

export const metadata: Metadata = {
  title: DOWNLOAD_TITLE,
  description: DOWNLOAD_DESCRIPTION,
  alternates: {
    canonical: "/download",
  },
  openGraph: {
    title: DOWNLOAD_TITLE,
    description: DOWNLOAD_DESCRIPTION,
    url: "/download",
    siteName: "SeenList",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DOWNLOAD_TITLE,
    description: DOWNLOAD_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function DownloadPage() {
  const highlights = [
    { icon: Tv, text: "Acompanhe episódio por episódio, de qualquer série." },
    { icon: Star, text: "Avalie com estrelas e escreva resenhas com spoiler marcado." },
    { icon: Users, text: "Siga outras pessoas e veja o que elas estão assistindo." },
  ];

  return (
    <main className="relative overflow-hidden bg-background">
      <Header />

      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-10 pt-6 text-center sm:px-8 sm:pt-12">
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-muted">Download</span>
        <h1 className="text-balance text-3xl font-extrabold leading-tight text-text sm:text-4xl">
          O SeenList vive no seu <span className="text-primary">celular</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted">
          Grátis, disponível pra Android e iPhone. Baixe e comece a montar sua biblioteca.
        </p>
        <div className="mt-7 flex justify-center">
          <StoreBadges className="scale-110" />
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-2xl px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.text}
              className={`${GLASS_CARD} flex flex-col items-center gap-3 p-5 text-center`}
              style={GLASS_CARD_BG}
            >
              <span className={`${GLASS_CHIP} h-9 w-9 shrink-0 items-center justify-center text-primary`} style={GLASS_CHIP_BG}>
                <item.icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <p className="text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 py-8 text-center sm:px-8 sm:py-10">
        <p className="text-sm text-muted">
          Quer saber mais antes de baixar?{" "}
          <Link href="/about" className="font-medium text-text underline hover:text-primary">
            Veja o que dá pra fazer no SeenList
          </Link>
          .
        </p>
      </section>

      <Footer />
    </main>
  );
}
