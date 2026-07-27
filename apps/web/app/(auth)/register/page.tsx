"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpWithEmail, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { FormFeedback } from "@/components/auth/FormFeedback";
import { InAppBrowserWarning } from "@/components/auth/InAppBrowserWarning";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const initialState: AuthActionState = { error: null };

export default function RegisterPage() {
  const [state, formAction] = useActionState(signUpWithEmail, initialState);
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <InAppBrowserWarning />
      <div>
        <h1 className="text-lg font-semibold text-text">{t("auth.createAccount")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.takesLessThanMinute")}</p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
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
          placeholder={t("auth.minEightChars")}
          required
          autoComplete="new-password"
        />
        <FormField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label={t("auth.confirmPassword")}
          placeholder={t("auth.repeatPassword")}
          required
          autoComplete="new-password"
        />
        <FormFeedback error={state.error} message={state.message} />
        <SubmitButton>{t("auth.createAccount")}</SubmitButton>
      </form>

      <p className="text-center text-sm text-muted">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:opacity-80">
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
