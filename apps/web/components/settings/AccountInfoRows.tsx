"use client";

import { useCurrentUser } from "@/lib/queries/current-user";
import { SettingsRow } from "./SettingsRow";
import { UidRow } from "./UidRow";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-030 (ajuste 2) — Nome/Foto saíram daqui de vez. A edição
 * continua exclusivamente na aba Perfil (botão "Editar",
 * `/profile/edit`) — sem exibição nem link em Configurações. E-mail
 * é somente leitura (mesmo `SettingsRow`, sem href/onClick). UID usa
 * `UidRow`, com o botão de copiar pedido no item 3.
 */
export function AccountInfoRows() {
  const { data: user } = useCurrentUser();
  const { t } = useTranslation();

  /*
   * CORREÇÃO (a pedido — auditoria de consistência web/mobile, mesmo
   * achado do Bloco 2 no mobile) — `if (!user) return null` deixava
   * a seção Conta em branco enquanto carregava, sem esqueleto
   * nenhum — pior que um spinner, parecia que a seção nem existia.
   */
  if (!user) {
    return (
      <div className="space-y-3 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-background" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-background" />
      </div>
    );
  }

  return (
    <>
      <SettingsRow label={t("auth.email")} value={user.email} />
      <UidRow uid={user.id} />
    </>
  );
}
