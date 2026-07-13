import { useState } from "react";
import type { ProfileVisibility } from "@/lib/settings";
import { updateVisibility } from "@/lib/settings";
import { SettingsRow } from "./SettingsRow";
import { OptionSheet } from "./OptionSheet";

const OPTIONS: ProfileVisibility[] = ["public", "followers", "private"];
const LABELS: Record<ProfileVisibility, string> = {
  public: "Público",
  followers: "Apenas seguidores",
  private: "Privado",
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

  async function handlePick(option: ProfileVisibility) {
    setOpen(false);
    onChanged(option); // otimista
    const result = await updateVisibility(field, option);
    if (result.error) onChanged(value); // desfaz se der erro
  }

  return (
    <>
      <SettingsRow label={label} value={LABELS[value]} onPress={() => setOpen(true)} last={last} />
      {open && (
        <OptionSheet
          title={label}
          onDismiss={() => setOpen(false)}
          actions={OPTIONS.map((option) => ({
            label: LABELS[option],
            active: option === value,
            onPress: () => handlePick(option),
          }))}
        />
      )}
    </>
  );
}
