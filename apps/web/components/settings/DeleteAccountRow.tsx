"use client";

import { useState } from "react";
import { deleteAccount } from "@/lib/actions/account";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ConfirmDialog } from "../series/ConfirmDialog";
import { SettingsRow } from "./SettingsRow";

type Step = "closed" | "step1" | "step2";

/** Item 6: "excluir conta deve solicitar confirmação dupla" — dois ConfirmDialog em sequência, não um só. */
export function DeleteAccountRow() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("closed");
  const [pending, setPending] = useState(false);

  async function handleFinalConfirm() {
    setPending(true);
    const result = await deleteAccount();
    setPending(false);
    if (result?.error) {
      // deleteAccount só devolve algo se der erro — sucesso já redireciona pro login.
      setStep("closed");
    }
  }

  return (
    <>
      <SettingsRow label={t("settings.deleteAccount")} danger onClick={() => setStep("step1")} last />

      {step === "step1" && (
        <ConfirmDialog
          title={t("deleteAccount.step1Title")}
          message={t("deleteAccount.step1Message")}
          onDismiss={() => setStep("closed")}
          actions={[
            { label: t("deleteAccount.confirmButton"), variant: "danger", onClick: () => setStep("step2") },
            { label: t("common.cancel"), variant: "default", onClick: () => setStep("closed") },
          ]}
        />
      )}

      {step === "step2" && (
        <ConfirmDialog
          title={t("deleteAccount.step2Title")}
          message={t("deleteAccount.step2Message")}
          onDismiss={() => setStep("closed")}
          actions={[
            {
              label: pending ? t("common.saving") : t("deleteAccount.confirmButton"),
              variant: "danger",
              onClick: handleFinalConfirm,
            },
            { label: t("common.cancel"), variant: "default", onClick: () => setStep("closed") },
          ]}
        />
      )}
    </>
  );
}
