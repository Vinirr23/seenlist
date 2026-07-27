"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { FormFeedback } from "@/components/auth/FormFeedback";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const initialState: AuthActionState = { error: null };

export function RequestResetForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">{t("auth.recoverPassword")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.resetLinkSent")}</p>
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
        <FormFeedback error={state.error} message={state.message} />
        <SubmitButton>{t("auth.sendLink")}</SubmitButton>
      </form>

      <p className="text-center text-sm">
        <Link href="/login" className="text-muted hover:text-text">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
