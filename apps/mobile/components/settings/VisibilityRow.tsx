import { useState } from "react";
import type { ProfileVisibility } from "@/lib/settings";
import { updateVisibility } from "@/lib/settings";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { SettingsRow } from "./SettingsRow";
import { OptionSheet } from "./OptionSheet";

const OPTIONS: ProfileVisibility[] = ["public", "followers", "private"];
const LABEL_KEYS: Record<ProfileVisibility, string> = {
  public: "settings.visibility.public",
  followers: "settings.visibility.followersOnly",
  private: "settings.visibility.private",
};

export function VisibilityRow({
  label,
  field,
  value,
  last,
  onChanged,
}: {
  label: string;
  field: "profileVisibility" | "favoritesVisibility" | "libraryVisibility";
  value: ProfileVisibility;
  last?: boolean;
  onChanged: (value: ProfileVisibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  async function handlePick(option: ProfileVisibility) {
    setOpen(false);
    onChanged(option); // otimista
    const result = await updateVisibility(field, option);
    if (result.error) onChanged(value); // desfaz se der erro
  }

  return (
    <>
      <SettingsRow label={label} value={t(LABEL_KEYS[value])} onPress={() => setOpen(true)} last={last} />
      {open && (
        <OptionSheet
          title={label}
          onDismiss={() => setOpen(false)}
          actions={OPTIONS.map((option) => ({
            label: t(LABEL_KEYS[option]),
            active: option === value,
            onPress: () => handlePick(option),
          }))}
        />
      )}
    </>
  );
}
