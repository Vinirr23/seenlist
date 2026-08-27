import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/**
 * Fonte do app inteiro (a pedido, "deixe todas as fontes iguais as do
 * mockup") — o mockup do "vidro" (mockup-perfil-atual-vidro-v2026-08-21)
 * usa "Plus Jakarta Sans" via Google Fonts; o app real não tinha
 * nenhuma fonte customizada configurada (só a fonte padrão do sistema
 * operacional do usuário). `next/font/google` baixa e hospeda a fonte
 * junto com o próprio app (não faz requisição externa em tempo de
 * execução, evita layout shift) — pesos 400 a 800 cobrem todos os
 * usados no app hoje (regular até extrabold).
 */
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    <html lang="pt-BR" className="dark">
      <body className={plusJakartaSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
