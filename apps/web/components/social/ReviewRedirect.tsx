"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social", Fase 1). `/r/[reviewId]`
 * existe só pra gerar o card de Open Graph pro crawler (WhatsApp/
 * Threads/etc.) — ver `page.tsx`/`opengraph-image.tsx`. Uma PESSOA de
 * verdade que abre o link é levada direto pra onde a review já é
 * exibida de verdade (`/movies/[id]/comments` ou
 * `/series/[id]/comments`, com `?highlight=` pra destacar ela —
 * mesmo mecanismo de `CommentsSection.tsx`/`ReviewCard.tsx`).
 *
 * Redirecionamento no CLIENTE, não `redirect()` do servidor: o HTML
 * inicial (com as tags de `generateMetadata`/`opengraph-image`) já
 * está presente antes deste efeito rodar — um crawler, que não
 * executa JS, lê a metadata certa; uma pessoa real é levada quase
 * instantaneamente. Link manual (`<a>`) como rede de segurança pra
 * quem tem JS desabilitado ou numa conexão lenta.
 */
export function ReviewRedirect({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [router, href]);

  return (
    <div style={{ display: "flex", minHeight: "60vh", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <a href={href} className="text-sm text-muted underline">
        Abrir avaliação no SeenList
      </a>
    </div>
  );
}
