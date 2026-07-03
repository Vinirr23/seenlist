"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithEmail, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { FormFeedback } from "@/components/auth/FormFeedback";

const initialState: AuthActionState = { error: null };

const REDIRECT_ERROR_MESSAGES: Record<string, string> = {
  google: "Não foi possível entrar com o Google agora. Tente de novo em instantes.",
  callback: "O link expirou ou já foi usado. Tente entrar novamente.",
};

function RedirectErrorBanner() {
  const searchParams = useSearchParams();
  const redirectError = searchParams.get("error");
  const message = redirectError ? REDIRECT_ERROR_MESSAGES[redirectError] : null;
  return message ? <FormFeedback error={message} /> : null;
}

function LoginForm() {
  const [state, formAction] = useActionState(signInWithEmail, initialState);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Acesse sua conta do SeenList.</p>
      </div>

      <Suspense fallback={null}>
        <RedirectErrorBanner />
      </Suspense>

      <GoogleButton />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
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
  return <LoginForm />;
}
