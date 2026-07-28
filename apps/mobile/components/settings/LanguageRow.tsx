import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";
import { SettingsRow } from "./SettingsRow";
import { OptionSheet } from "./OptionSheet";

const LOCALES: Locale[] = ["pt-BR", "en", "es"];

/** Equivalente nativo de `LanguageRow.tsx` do web — troca em tempo real, sem precisar reabrir o app. */
export function LanguageRow({ last }: { last?: boolean }) {
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow label={t("settings.language")} value={LOCALE_LABELS[locale]} onPress={() => setOpen(true)} last={last} />
      {open && (
        <OptionSheet
          title={t("settings.language")}
          onDismiss={() => setOpen(false)}
          actions={LOCALES.map((option) => ({
            label: LOCALE_LABELS[option],
            active: option === locale,
            onPress: () => {
              setLocale(option);
              setOpen(false);
            },
          }))}
        />
      )}
    </>
  );
}
