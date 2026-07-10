"use client";

import { useState } from "react";
import type { ProfileVisibility } from "@/lib/queries/social-types";
import { useMyProfile, useUpdateMyProfile, type UpdateProfileInput } from "@/lib/queries/my-profile";
import { useToast } from "@/lib/toast/ToastProvider";
import { ConfirmDialog } from "../series/ConfirmDialog";
import { SettingsRow } from "./SettingsRow";

const OPTIONS: ProfileVisibility[] = ["public", "followers", "private"];

const LABELS: Record<ProfileVisibility, string> = {
  public: "Público",
  followers: "Apenas seguidores",
  private: "Privado",
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

  async function handlePick(option: ProfileVisibility) {
    setOpen(false);
    const result = await updateProfile.mutate({ [field]: option });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Privacidade atualizada");
    }
  }

  return (
    <>
      <SettingsRow label={label} value={LABELS[value]} onClick={() => setOpen(true)} last={last} />
      {open && (
        <ConfirmDialog
          title={label}
          onDismiss={() => setOpen(false)}
          actions={[
            ...OPTIONS.map((option) => ({
              label: LABELS[option],
              variant: option === value ? ("primary" as const) : ("default" as const),
              onClick: () => handlePick(option),
            })),
            { label: "Cancelar", variant: "default" as const, onClick: () => setOpen(false) },
          ]}
        />
      )}
    </>
  );
}

/** Agrupa as 3 linhas — usado direto pela tela de Configurações. */
export function PrivacySection() {
  const { data: profile } = useMyProfile();
  if (!profile) return null;

  return (
    <>
      <VisibilityRow label="Perfil" field="profileVisibility" value={profile.profileVisibility} />
      <VisibilityRow label="Biblioteca" field="libraryVisibility" value={profile.libraryVisibility} />
      <VisibilityRow label="Favoritos" field="favoritesVisibility" value={profile.favoritesVisibility} last />
    </>
  );
}
