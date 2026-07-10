"use client";

import { useState } from "react";
import { updatePasswordAction } from "@/lib/actions/account";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { SettingsRow } from "./SettingsRow";
import { TextPromptDialog } from "./TextPromptDialog";

export function PasswordRow({ last }: { last?: boolean } = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: Record<string, string>) {
    setPending(true);
    setError(null);
    const result = await updatePasswordAction(values.password ?? "", values.confirmPassword ?? "");
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <SettingsRow label={t("settings.password")} value="••••••••" onClick={() => setOpen(true)} last={last} />
      {open && (
        <TextPromptDialog
          title={t("settings.changePassword.title")}
          fields={[
            { name: "password", label: t("settings.changePassword.new"), type: "password" },
            { name: "confirmPassword", label: t("settings.changePassword.confirm"), type: "password" },
          ]}
          submitLabel={pending ? t("common.saving") : t("common.save")}
          cancelLabel={t("common.cancel")}
          pending={pending}
          error={error}
          onSubmit={handleSubmit}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}
