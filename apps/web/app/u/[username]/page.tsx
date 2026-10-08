import type { Metadata } from "next";
import { PublicProfileView } from "@/components/social/PublicProfileView";
import { fetchProfileShareCard } from "@/lib/server/profileShareCard";
import { formatWatchMinutesPlain } from "@/lib/server/formatWatchMinutesPlain";
import { MobileAppPromoBanner } from "@/components/layout/MobileAppPromoBanner";
import { ProfileAppPromoModal } from "@/components/layout/ProfileAppPromoModal";

/**
 * A PEDIDO (2026-10-08 — "preciso que o perfil fique compartilhável
 * nas redes sociais igual ao Bingers"). Causa raiz do problema
 * original: esta página nunca teve `generateMetadata`, então herdava
 * sempre o card genérico do site inteiro (`app/layout.tsx`).
 *
 * Deliberadamente NÃO define `openGraph.images`/`twitter.images` aqui
 * — o arquivo de convenção `opengraph-image.tsx`, colocado ao lado
 * desta página, já injeta essas tags sozinho (URL absoluta,
 * width/height/alt corretos). Declarar `images` nos dois lugares
 * duplicaria a tag.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const card = await fetchProfileShareCard(username);

  // Perfil inexistente ou privado: herda o metadata genérico do site
  // (`app/layout.tsx`) — não revela nem o nome de exibição de um
  // perfil privado no título da aba/preview do link.
  if (!card) return {};

  const title = `${card.displayName} (@${card.username}) no SeenList`;
  const description = card.stats
    ? `${card.stats.watchedCount} assistidos · ${formatWatchMinutesPlain(card.stats.watchMinutes)} de tela. Organize filmes, séries e animes no SeenList.`
    : "Organize filmes, séries e animes no SeenList.";

  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * A PEDIDO (2026-10-08, reportado — "quando alguém clica no link desse
 * banner [de compartilhar perfil] abre essa tela, mas não tem nada aí
 * tipo 'baixe o app'") — causa raiz: `MobileAppPromoBanner` já existe
 * e já aparece em TODO o resto do site (incluído uma vez só, em
 * `app/(main)/layout.tsx`), mas esta rota (`app/u/[username]`) vive
 * FORA do grupo `(main)` — só herda o `app/layout.tsx` raiz, que não
 * inclui o banner. É exatamente a página que mais recebe visitante sem
 * conta (clicou num link de perfil compartilhado), e era a única sem
 * nenhum CTA de instalar o app. Corrigido incluindo o mesmo
 * componente aqui, sem alterar o componente em si.
 *
 * A PEDIDO (mesmo dia, pedido seguinte) — além da faixa fina acima,
 * `ProfileAppPromoModal` mostra um popup maior (mensagem + botões das
 * duas lojas) só na primeira abertura desta página compartilhada —
 * fecha com X e deixa navegar o perfil normalmente (não bloqueia).
 */
export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return (
    <>
      <MobileAppPromoBanner />
      <ProfileAppPromoModal />
      <PublicProfileView username={username} />
    </>
  );
}
