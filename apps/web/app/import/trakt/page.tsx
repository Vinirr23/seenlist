import { Suspense } from "react";
import { env } from "@/lib/env";
import { TRAKT_REDIRECT_URI } from "@/lib/trakt/client";
import { TraktImportWizard } from "@/components/trakt-import/TraktImportWizard";

/**
 * TASK-171 — a URL de autorização do Trakt só precisa do
 * `client_id` (não é secreto de verdade — aparece na própria URL
 * que o usuário abre) — mesmo assim, montada aqui no servidor
 * (Server Component, padrão do App Router) em vez de expor a
 * variável de ambiente ao cliente via `NEXT_PUBLIC_`, por
 * consistência com o resto do projeto (nenhuma variável de ambiente
 * do Trakt tem prefixo público).
 *
 * `<Suspense>` é exigência do Next.js pra qualquer Client Component
 * que use `useSearchParams` (mesmo padrão já usado em
 * `app/(auth)/login/page.tsx`).
 */
export default function TraktImportPage() {
  const authorizeUrl = `https://trakt.tv/oauth/authorize?response_type=code&client_id=${env.traktClientId()}&redirect_uri=${encodeURIComponent(
    TRAKT_REDIRECT_URI
  )}`;

  return (
    <Suspense fallback={null}>
      <TraktImportWizard authorizeUrl={authorizeUrl} />
    </Suspense>
  );
}
