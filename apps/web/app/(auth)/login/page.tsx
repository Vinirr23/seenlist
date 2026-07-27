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
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const initialState: AuthActionState = { error: null };

/**
 * `useSearchParams` exige estar dentro de <Suspense> no App Router —
 * por isso o conteúdo de verdade fica aqui, e `LoginPage` só embrulha
 * isso num Suspense.
 */
function LoginPageContent() {
  const [state, formAction] = useActionState(signInWithEmail, initialState);
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const redirectErrorMessages: Record<string, string> = {
    google: t("auth.googleSignInError"),
    callback: t("auth.linkExpiredError"),
  };

  const redirectError = searchParams.get("error");
  const redirectErrorMessage = redirectError ? redirectErrorMessages[redirectError] : null;

  // Se o usuário chegou aqui tentando abrir uma página específica
  // (ver middleware.ts, que guarda isso em ?redirectTo=), volta pra
  // ela depois de logar em vez de cair sempre em /series.
  const redirectTo = searchParams.get("redirectTo") ?? "";

  return (
    <div className="space-y-6">
      <InAppBrowserWarning />
      <div>
        <h1 className="text-lg font-semibold text-text">{t("auth.signIn")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.accessYourAccount")}</p>
      </div>

      {redirectErrorMessage && <FormFeedback error={redirectErrorMessage} />}

      <GoogleButton redirectTo={redirectTo} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <FormField
          id="email"
          name="email"
          type="email"
          label={t("auth.email")}
          placeholder="voce@exemplo.com"
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label={t("auth.password")}
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
        <FormFeedback error={state.error} />
        <SubmitButton>{t("auth.signIn")}</SubmitButton>
      </form>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-text">
          {t("auth.forgotPassword")}
        </Link>
        <Link href="/register" className="font-medium text-primary hover:opacity-80">
          {t("auth.createAccount")}
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
