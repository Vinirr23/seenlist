import { Suspense } from "react";
import { env } from "@/lib/env";
import { TRAKT_REDIRECT_URI } from "@/lib/trakt/client";
import { TraktImportWizard } from "@/components/trakt-import/TraktImportWizard";

/**
 * TASK-171 (correção — achado real, build quebrou) — sem nenhuma
 * API "dinâmica" (cookies, headers, etc.), o Next.js tenta PRÉ-
 * RENDERIZAR esta página em tempo de BUILD, antes até do deploy
 * rodar de verdade — e nesse momento a variável de ambiente pode não
 * estar disponível do mesmo jeito que fica em tempo de execução real
 * (dependendo de como a Vercel expõe env var pra build vs runtime).
 * `force-dynamic` tira essa página da pré-renderização estática —
 * ela só roda (e só lê a env var) quando alguém pede de verdade, em
 * tempo de execução, igual `/admin/invite` já fazia sem precisar
 * disso explicitamente (lá, ler cookies já força isso sozinho).
 */
export const dynamic = "force-dynamic";

/**
 * A URL de autorização do Trakt só precisa do `client_id` (não é
 * secreto de verdade — aparece na própria URL que o usuário abre) —
 * mesmo assim, montada aqui no servidor (Server Component, padrão
 * do App Router) em vez de expor a variável de ambiente ao cliente
 * via `NEXT_PUBLIC_`, por consistência com o resto do projeto
 * (nenhuma variável de ambiente do Trakt tem prefixo público).
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
