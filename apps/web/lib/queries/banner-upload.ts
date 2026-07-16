"use client";

import { useState } from "react";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast/ToastProvider";
import { useUpdateMyProfile } from "./my-profile";

/**
 * Mesma mecânica de `useAvatarUpload` (mesmo bucket "avatars", só
 * separa o arquivo por pasta) — a diferença é o destino final:
 * banner mora em `profiles.banner_url`, não em `user_metadata`,
 * então usa `useUpdateMyProfile` no lugar de `auth.updateUser`.
 */
export function useBannerUpload() {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const updateProfile = useUpdateMyProfile();

  async function upload(file: File) {
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const extension = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/banner-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const result = await updateProfile.mutate({ bannerUrl: urlData.publicUrl });
      if (result.error) throw new Error(result.error);

      toast.success("Banner alterado");
    } catch (error) {
      console.error(
        '[profile] Falha ao enviar banner — confira se o bucket "avatars" existe no Supabase Storage.',
        error
      );
      toast.error("Erro de conexão");
    } finally {
      setPending(false);
    }
  }

  return { upload, pending };
}
