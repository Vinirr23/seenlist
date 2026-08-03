import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/**
 * A PEDIDO — fonte de exibição pra título de série/filme e nome de
 * seção (decidida numa sessão de exploração visual). `next/font`
 * auto-hospeda o arquivo (baixa uma vez, serve junto do próprio
 * site — sem ida-e-volta extra pro Google toda vez que alguém abre
 * uma página) e já usa `display: swap` por padrão (o texto aparece
 * na hora com a fonte do sistema, troca suave quando a de verdade
 * carrega — nunca trava o carregamento da página).
 *
 * Só os pesos 700 e 800 — os únicos usados nos mockups — não a
 * família inteira. Aplicada via variável CSS (`--font-display`),
 * disponível em qualquer componente como a classe `font-display`
 * (ver `packages/config/src/tailwind-tokens.ts`).
 */
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
  display: "swap",
});

const SITE_URL = "https://seenlist.app";
const SITE_TITLE = "SeenList";
const SITE_DESCRIPTION = "Track your TV shows and movies, discover new favorites and never miss an episode.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "en_US",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`dark ${bricolageGrotesque.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
