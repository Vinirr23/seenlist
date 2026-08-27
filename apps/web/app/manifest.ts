import type { MetadataRoute } from "next";

/**
 * A PEDIDO (2026-08-27 — "no iphone tem como bloquear esses botões que
 * aparecem no print 1, pra ficar sempre igual o print 2, esses botões
 * atrapalham") — os "botões" do print 1 eram a barra do próprio Safari
 * flutuando sobre a página; código de site NÃO consegue removê-la
 * enquanto o site roda dentro de uma aba normal do navegador. A única
 * forma real de nunca mais aparecer é o iPhone abrir o SeenList como um
 * app instalado (via "Adicionar à Tela de Início"), o que só fica sem
 * NENHUMA barra de navegador quando o site se declara "instalável" —
 * o que faltava por completo (não existia manifest nenhum no projeto).
 *
 * Esse arquivo é a convenção do Next.js (`app/manifest.ts`) — ele já
 * gera e injeta sozinho o `<link rel="manifest">` certo, sem precisar
 * mexer no `<head>` manualmente. Os ícones (192/512/maskable) foram
 * gerados a partir do `logo.png` que já existia em `public/` (mesmo
 * logo amarelo em fundo escuro, só redimensionado/recortado nos
 * tamanhos que o padrão de manifest exige).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SeenList",
    short_name: "SeenList",
    description:
      "Acompanhe suas séries e filmes, descubra novidades e nunca perca um episódio.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0E14",
    theme_color: "#0B0E14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
