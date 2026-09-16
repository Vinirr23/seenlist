import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const SITE_URL = "https://seenlist.app";
// Nome da marca (usado em `openGraph.siteName` e `appleWebApp.title`,
// SEPARADO do título de página abaixo — ver comentário na revisão de
// metadados de 2026-09-16).
const BRAND_NAME = "SeenList";
/**
 * REVISÃO DE METADADOS (2026-09-16, a pedido — "revise os metadados
 * públicos do SeenList") — três problemas achados aqui: `title` era só
 * "SeenList" (sem dizer o que o produto FAZ, pior pra CTR na busca),
 * `description` estava em inglês (o resto do site é pt-BR, `html.lang`
 * inclusive) e `openGraph.locale` era "en_US" (dizia ao Facebook/
 * WhatsApp/etc. que o conteúdo é em inglês, quando não é). `alternates.
 * canonical` fixo pra home SAIU daqui — ver `app/page.tsx`, que agora
 * define o canonical dela mesma (a razão de ficar fixo aqui era ruim:
 * qualquer página-filha SEM `alternates.canonical` próprio herdava
 * "https://seenlist.app" como canonical dela também, não só a home —
 * só não dava problema hoje porque /about, /privacy e /terms já têm o
 * delas próprio; conferido nesta revisão).
 */
const SITE_TITLE = "SeenList — Organize séries e filmes";
const SITE_DESCRIPTION =
  "Organize filmes, séries e animes, marque episódios assistidos, acompanhe estreias e descubra o que seus amigos estão vendo. Grátis na web e no Android.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: {
    apple: "/apple-touch-icon.png",
  },
  /**
   * A PEDIDO (2026-08-27 — "no iphone tem como bloquear esses botões
   * que aparecem no print 1, pra ficar sempre igual o print 2") — ver
   * comentário completo em `app/manifest.ts` pro porquê disso resolver
   * o problema pela raiz. `capable: true` é o que faz o iOS abrir o
   * ícone da Tela de Início em tela cheia (sem NENHUMA barra do
   * Safari) em vez de como uma aba normal — sem isso, mesmo com o
   * `manifest.ts` existindo, o iPhone especificamente (diferente do
   * Android) ainda mostraria a barra do navegador.
   */
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_NAME,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND_NAME,
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
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

/**
 * Desde o Next.js 14, cor de tema/viewport saiu de `metadata` e virou
 * um export próprio — mantido junto do `appleWebApp` acima (mesmo
 * ajuste, mesmo motivo). `viewportFit: "cover"` deixa o conteúdo
 * ocupar até embaixo da "ilha dinâmica"/notch quando instalado como
 * app, combinando com `statusBarStyle: "black-translucent"`.
 */
export const viewport: Viewport = {
  themeColor: "#0B0E14",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={plusJakartaSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}