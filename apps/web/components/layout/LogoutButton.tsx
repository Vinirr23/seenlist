"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/actions/auth";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ConfirmDialog } from "@/components/series/ConfirmDialog";

export interface LogoutButtonProps {
  className: string;
  children: React.ReactNode;
  "aria-label"?: string;
}

/**
 * TASK-021, item 6: "encerrar sessão, limpar caches, redirecionar
 * pra login" — `queryClient.clear()` evita que dado da conta
 * anterior apareça por um instante se outra pessoa logar em seguida
 * no mesmo navegador.
 *
 * Ajuste (Configurações, item 7): agora sempre pergunta antes de
 * sair — "Deseja realmente sair?" — em vez de agir direto no clique.
 * Como é o mesmo componente usado pela barra superior E pela tela de
 * Configurações, as duas ganham o mesmo comportamento de uma vez,
 * sem duplicar a lógica de logout em dois lugares.
 */
export function LogoutButton({ className, children, ...rest }: LogoutButtonProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    queryClient.clear();
    await signOut();
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setConfirming(true)} {...rest}>
        {children}
      </button>

      {confirming && (
        <ConfirmDialog
          title={t("logout.confirmTitle")}
          message={t("logout.confirmMessage")}
          onDismiss={() => setConfirming(false)}
          actions={[
            { label: pending ? t("common.saving") : t("settings.logout"), variant: "danger", onClick: handleConfirm },
            { label: t("common.cancel"), variant: "default", onClick: () => setConfirming(false) },
          ]}
        />
      )}
    </>
  );
}
