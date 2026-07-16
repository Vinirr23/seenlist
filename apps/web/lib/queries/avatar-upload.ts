"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast/ToastProvider";

/**
 * TASK-026A, item 6: "reutilizar a lógica existente — upload de
 * avatar já funciona". Extraído de `PhotoRow` (que deixou de existir
 * em Configurações) pra cá, sem mudar nada do comportamento — mesmo
 * bucket "avatars", mesmo `updateUser({ avatar_url })`.
 */
export function useAvatarUpload() {
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  async function upload(file: File) {
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: urlData.publicUrl } });
      if (updateError) throw updateError;

      // Mesmo raciocínio de lib/actions/account.ts (updateName):
      // user_metadata continua atualizado (compatibilidade), mas
      // profiles.avatar_url é o que de fato fica visível pra outros
      // usuários — user_metadata nunca foi público via RLS.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (profileError) {
        console.error("[account] Avatar salvo em user_metadata, mas falhou ao sincronizar em profiles", profileError);
      }

      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Foto alterada");
    } catch (error) {
      console.error(
        '[account] Falha ao enviar foto de perfil — confira se o bucket "avatars" existe no Supabase Storage.',
        error
      );
      toast.error("Erro de conexão");
    } finally {
      setPending(false);
    }
  }

  return { upload, pending };
}
