"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateName } from "@/lib/actions/account";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { SettingsRow } from "./SettingsRow";
import { TextPromptDialog } from "./TextPromptDialog";

export function NameRow({ currentName }: { currentName: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function handleSubmit(values: Record<string, string>) {
    setPending(true);
    setError(null);
    const result = await updateName(values.name ?? "");
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["current-user"] });
    toast.success("Perfil atualizado");
    setOpen(false);
  }

  return (
    <>
      <SettingsRow label={t("settings.name")} value={currentName} onClick={() => setOpen(true)} />
      {open && (
        <TextPromptDialog
          title={t("settings.changeName.title")}
          fields={[
            {
              name: "name",
              label: t("settings.name"),
              placeholder: t("settings.changeName.placeholder"),
              defaultValue: currentName,
            },
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
