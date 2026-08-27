"use client";

import { useState } from "react";
import { deleteAccount } from "@/lib/actions/account";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ConfirmDialog } from "../series/ConfirmDialog";
import { SettingsRow } from "./SettingsRow";

type Step = "closed" | "step1" | "step2";

export interface DeleteAccountRowProps {
  /**
   * Redesign de Configurações (2026-08-25, a partir de sugestão do GPT
   * revisada) — "excluir conta" não deve competir visualmente com o
   * resto da tela: sem caixa, sem chevron, sozinho e afastado do botão
   * "Sair" por espaço extra. `bare` troca a linha (SettingsRow, dentro
   * de uma Section) por um texto vermelho discreto e centralizado. A
   * lógica de confirmação dupla abaixo não muda em nenhum dos dois modos.
   */
  bare?: boolean;
}

/** Item 6: "excluir conta deve solicitar confirmação dupla" — dois ConfirmDialog em sequência, não um só. */
export function DeleteAccountRow({ bare }: DeleteAccountRowProps) {
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
      {bare ? (
        <button
          type="button"
          onClick={() => setStep("step1")}
          className="text-xs text-danger/80 transition-colors hover:text-danger"
        >
          {t("settings.deleteAccount")}
        </button>
      ) : (
        <SettingsRow label={t("settings.deleteAccount")} danger onClick={() => setStep("step1")} last />
      )}

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
