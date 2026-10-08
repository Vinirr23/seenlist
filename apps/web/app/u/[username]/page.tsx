import type { Metadata } from "next";
import { PublicProfileView } from "@/components/social/PublicProfileView";
import { fetchProfileShareCard } from "@/lib/server/profileShareCard";
import { formatWatchMinutesPlain } from "@/lib/server/formatWatchMinutesPlain";

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

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PublicProfileView username={username} />;
}
