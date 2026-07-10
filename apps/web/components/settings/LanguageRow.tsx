"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";
import { useToast } from "@/lib/toast/ToastProvider";
import { ConfirmDialog } from "../series/ConfirmDialog";
import { SettingsRow } from "./SettingsRow";

const LOCALES: Locale[] = ["pt-BR", "en", "es"];

/** Item 1: troca em tempo real (o `t()` já reflete a mudança assim que `setLocale` roda, sem reload). */
export function LanguageRow() {
  const { locale, setLocale, t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow label={t("settings.language")} value={LOCALE_LABELS[locale]} onClick={() => setOpen(true)} />
      {open && (
        <ConfirmDialog
          title={t("settings.language")}
          onDismiss={() => setOpen(false)}
          actions={[
            ...LOCALES.map((option) => ({
              label: LOCALE_LABELS[option],
              variant: option === locale ? ("primary" as const) : ("default" as const),
              onClick: () => {
                setLocale(option);
                setOpen(false);
                toast.success("Idioma alterado");
              },
            })),
            { label: t("common.cancel"), variant: "default" as const, onClick: () => setOpen(false) },
          ]}
        />
      )}
    </>
  );
}
