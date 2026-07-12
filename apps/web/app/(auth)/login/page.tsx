"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithEmail, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { FormFeedback } from "@/components/auth/FormFeedback";
import { InAppBrowserWarning } from "@/components/auth/InAppBrowserWarning";

const initialState: AuthActionState = { error: null };

const REDIRECT_ERROR_MESSAGES: Record<string, string> = {
  google: "Não foi possível entrar com o Google agora. Tente de novo em instantes.",
  callback: "O link expirou ou já foi usado. Tente entrar novamente.",
};

/**
 * `useSearchParams` exige estar dentro de <Suspense> no App Router —
 * por isso o conteúdo de verdade fica aqui, e `LoginPage` só embrulha
 * isso num Suspense.
 */
function LoginPageContent() {
  const [state, formAction] = useActionState(signInWithEmail, initialState);
  const searchParams = useSearchParams();

  const redirectError = searchParams.get("error");
  const redirectErrorMessage = redirectError ? REDIRECT_ERROR_MESSAGES[redirectError] : null;

  // Se o usuário chegou aqui tentando abrir uma página específica
  // (ver middleware.ts, que guarda isso em ?redirectTo=), volta pra
  // ela depois de logar em vez de cair sempre em /series.
  const redirectTo = searchParams.get("redirectTo") ?? "";

  return (
    <div className="space-y-6">
      <InAppBrowserWarning />
      <div>
        <h1 className="text-lg font-semibold text-text">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Acesse sua conta do SeenList.</p>
      </div>

      {redirectErrorMessage && <FormFeedback error={redirectErrorMessage} />}

      <GoogleButton redirectTo={redirectTo} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <FormField
          id="email"
          name="email"
          type="email"
          label="E-mail"
          placeholder="voce@exemplo.com"
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Senha"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
        <FormFeedback error={state.error} />
        <SubmitButton>Entrar</SubmitButton>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-text">
          Esqueceu a senha?
        </Link>
        <Link href="/register" className="font-medium text-primary hover:opacity-80">
          Criar conta
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
