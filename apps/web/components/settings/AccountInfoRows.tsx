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

  if (!user) return null;

  return (
    <>
      <SettingsRow label={t("auth.email")} value={user.email} />
      <UidRow uid={user.id} />
    </>
  );
}
