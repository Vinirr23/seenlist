"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/lib/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { FormFeedback } from "@/components/auth/FormFeedback";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const initialState: AuthActionState = { error: null };

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text">{t("auth.setNewPassword")}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.chooseNewPassword")}</p>
      </div>

      <form action={formAction} className="space-y-4">
        <FormField
          id="password"
          name="password"
          type="password"
          label={t("settings.changePassword.new")}
          placeholder={t("auth.minEightChars")}
          required
          autoComplete="new-password"
        />
        <FormField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label={t("settings.changePassword.confirm")}
          placeholder={t("auth.repeatPassword")}
          required
          autoComplete="new-password"
        />
        <FormFeedback error={state.error} />
        <SubmitButton>{t("auth.savePassword")}</SubmitButton>
      </form>
    </div>
  );
}
