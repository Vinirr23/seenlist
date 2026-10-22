"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-079 — último passo da ponte de login do Google dentro do app
 * nativo: `apps/mobile/app/index.tsx` navega a WEBVIEW (não o
 * navegador externo que fez o login) pra esta página, com os tokens
 * na URL. `supabase.auth.setSession(...)` aqui roda com o cliente do
 * NAVEGADOR (`lib/supabase/client.ts`) — é isso que grava a sessão no
 * armazenamento da própria WebView, que é o contexto que precisa
 * ficar logado (não o navegador externo onde o Google realmente
 * aconteceu).
 */
function MobileBridgeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [error, setError] = useState(false);

  useEffect(() => {
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError(true);
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: setError_ }) => {
      if (setError_) {
        console.error("[auth/mobile-bridge] Falha ao estabelecer sessão", setError_);
        setError(true);
        return;
      }
      // FASE 2 (2026-10-21) — "/series" está sendo descontinuado. O fluxo
      // ATUAL de login Google do app (AuthProvider.tsx, signInWithGoogle)
      // não passa mais por esta ponte — usa WebBrowser.openAuthSessionAsync
      // direto pro deep link nativo seenlist://auth-callback. Esta página
      // só é mantida por segurança, caso algum build antigo ainda dependa
      // dela; o destino final, se isso acontecer, agora é /download em vez
      // de uma página que deixa de existir. Nenhuma troca de token/sessão
      // (setSession acima) foi alterada.
      router.replace("/download");
    });
  }, [searchParams, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 text-center">
      <p className="text-sm text-muted">{error ? t("auth.googleSignInError") : t("auth.signingIn")}</p>
    </div>
  );
}

export default function MobileBridgePage() {
  return (
    <Suspense fallback={null}>
      <MobileBridgeContent />
    </Suspense>
  );
}
