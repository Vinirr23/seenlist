"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTheme, type ThemePreference } from "@/lib/theme/ThemeProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { ConfirmDialog } from "../series/ConfirmDialog";
import { SettingsRow } from "./SettingsRow";

const OPTIONS: ThemePreference[] = ["dark", "light", "system"];

export function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const labelFor = (option: ThemePreference) => t(`settings.theme.${option}`);

  return (
    <>
      <SettingsRow label={t("settings.theme")} value={labelFor(theme)} onClick={() => setOpen(true)} />
      {open && (
        <ConfirmDialog
          title={t("settings.theme")}
          onDismiss={() => setOpen(false)}
          actions={[
            ...OPTIONS.map((option) => ({
              label: labelFor(option),
              variant: option === theme ? ("primary" as const) : ("default" as const),
              onClick: () => {
                setTheme(option);
                setOpen(false);
                toast.success("Tema alterado");
              },
            })),
            { label: t("common.cancel"), variant: "default" as const, onClick: () => setOpen(false) },
          ]}
        />
      )}
    </>
  );
}
