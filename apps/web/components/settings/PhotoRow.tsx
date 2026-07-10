"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/lib/toast/ToastProvider";
import { SettingsRow } from "./SettingsRow";

/**
 * Precisa de um bucket de Storage chamado "avatars" no projeto
 * Supabase (público pra leitura, gravação restrita ao próprio
 * usuário) — isso não existe por padrão e não tem como eu criar ou
 * confirmar que existe daqui. Sem o bucket, o upload falha com um
 * erro claro no console (não trava a tela).
 */
export function PhotoRow() {
  const { t } = useTranslation();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: urlData.publicUrl } });
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Foto alterada");
    } catch (uploadOrUpdateError) {
      console.error("[account] Falha ao enviar foto de perfil — confira se o bucket \"avatars\" existe no Supabase Storage.", uploadOrUpdateError);
      setError(t("common.error"));
      toast.error("Erro de conexão");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <SettingsRow
        label={t("settings.photo")}
        value={pending ? t("common.saving") : undefined}
        onClick={() => inputRef.current?.click()}
      />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
    </>
  );
}
