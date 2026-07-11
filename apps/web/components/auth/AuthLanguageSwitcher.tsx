"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";
import { ConfirmDialog } from "../series/ConfirmDialog";

const LOCALES: Locale[] = ["pt-BR", "en", "es"];

/** Mesmo `ConfirmDialog`/`LOCALE_LABELS` de `LanguageRow.tsx` (Configurações) — aqui só muda o botão que abre (compacto, canto da tela, sem depender de já estar logado). */
export function AuthLanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted"
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={2} />
        {LOCALE_LABELS[locale]}
      </button>
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
              },
            })),
            { label: t("common.cancel"), variant: "default" as const, onClick: () => setOpen(false) },
          ]}
        />
      )}
    </>
  );
}
