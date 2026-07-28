"use client";

import { useState } from "react";
import type { ProfileVisibility } from "@/lib/queries/social-types";
import { useMyProfile, useUpdateMyProfile, type UpdateProfileInput } from "@/lib/queries/my-profile";
import { useToast } from "@/lib/toast/ToastProvider";
import { ConfirmDialog } from "../series/ConfirmDialog";
import { SettingsRow } from "./SettingsRow";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const OPTIONS: ProfileVisibility[] = ["public", "followers", "private"];

const LABEL_KEYS: Record<ProfileVisibility, string> = {
  public: "settings.visibility.public",
  followers: "settings.visibility.followersOnly",
  private: "settings.visibility.private",
};

export interface VisibilityRowProps {
  label: string;
  field: keyof Pick<UpdateProfileInput, "profileVisibility" | "libraryVisibility" | "favoritesVisibility">;
  value: ProfileVisibility;
  last?: boolean;
}

/**
 * TASK-028, item 7 — três instâncias desta mesma linha (Perfil,
 * Biblioteca, Favoritos), cada uma editando um campo diferente de
 * `profiles` via `useUpdateMyProfile` (já existia, não foi criado
 * agora). "Estrutura pronta pra expansão futura" — a aplicação real
 * dessas 3 configurações já está em vigor via RLS (ver migration),
 * não é só um valor guardado sem efeito.
 */
export function VisibilityRow({ label, field, value, last }: VisibilityRowProps) {
  const [open, setOpen] = useState(false);
  const updateProfile = useUpdateMyProfile();
  const toast = useToast();
  const { t } = useTranslation();

  async function handlePick(option: ProfileVisibility) {
    setOpen(false);
    const result = await updateProfile.mutate({ [field]: option });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("settings.privacyUpdated"));
    }
  }

  return (
    <>
      <SettingsRow label={label} value={t(LABEL_KEYS[value])} onClick={() => setOpen(true)} last={last} />
      {open && (
        <ConfirmDialog
          title={label}
          onDismiss={() => setOpen(false)}
          actions={[
            ...OPTIONS.map((option) => ({
              label: t(LABEL_KEYS[option]),
              variant: option === value ? ("primary" as const) : ("default" as const),
              onClick: () => handlePick(option),
            })),
            { label: t("common.cancel"), variant: "default" as const, onClick: () => setOpen(false) },
          ]}
        />
      )}
    </>
  );
}

/** Agrupa as 3 linhas — usado direto pela tela de Configurações. */
export function PrivacySection() {
  const { data: profile } = useMyProfile();
  const { t } = useTranslation();
  if (!profile) return null;

  return (
    <>
      <VisibilityRow label={t("nav.profile")} field="profileVisibility" value={profile.profileVisibility} />
      <VisibilityRow label={t("settings.library")} field="libraryVisibility" value={profile.libraryVisibility} />
      <VisibilityRow label={t("settings.favorites")} field="favoritesVisibility" value={profile.favoritesVisibility} last />
    </>
  );
}
