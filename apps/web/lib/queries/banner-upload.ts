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
      /*
       * A PEDIDO ("eu não consigo redimensionar o banner pra ficar do
       * jeito que eu quero") — `bannerFocalY: 0.5` reseta o ajuste de
       * enquadramento pro centro (padrão) sempre que a FOTO muda: o
       * ajuste anterior foi calibrado pra imagem antiga, não faz
       * sentido nenhum continuar aplicado numa foto diferente.
       */
      const result = await updateProfile.mutate({ bannerUrl: urlData.publicUrl, bannerFocalY: 0.5 });
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

/**
 * Ver o comentário equivalente em `avatar-upload.ts`
 * (`useSetAvatarFromLibrary`) — mesma ideia, pro banner: grava a URL
 * do TMDB direto em `profiles.banner_url`, sem baixar/reenviar
 * arquivo nenhum.
 */
export function useSetBannerFromLibrary() {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const updateProfile = useUpdateMyProfile();

  async function setFromUrl(url: string) {
    setPending(true);
    try {
      // Ver o comentário equivalente em `useBannerUpload.upload`, acima — mesmo reset de enquadramento ao trocar a foto.
      const result = await updateProfile.mutate({ bannerUrl: url, bannerFocalY: 0.5 });
      if (result.error) throw new Error(result.error);
      toast.success("Banner alterado");
    } catch (error) {
      console.error("[profile] Falha ao salvar banner escolhido da biblioteca", error);
      toast.error("Erro de conexão");
    } finally {
      setPending(false);
    }
  }

  return { setFromUrl, pending };
}

/**
 * NOVO (a pedido — "eu não consigo redimensionar o banner pra ficar
 * do jeito que eu quero", 2026-09-16) — salva só o ajuste vertical de
 * enquadramento (`profiles.banner_focal_y`), sem mexer na URL da
 * foto. Usado pelo controle de arrastar/slider em
 * `EditProfileView.tsx`: chamado quando a pessoa SOLTA o controle
 * (não a cada pixel arrastado — evita uma escrita no banco por
 * frame), sem toast de sucesso (o feedback já é visual, a prévia se
 * move em tempo real).
 */
export function useSetBannerFocalY() {
  const updateProfile = useUpdateMyProfile();

  async function setFocalY(value: number) {
    const result = await updateProfile.mutate({ bannerFocalY: value });
    if (result.error) {
      console.error("[profile] Falha ao salvar posição do banner", result.error);
    }
  }

  return { setFocalY };
}
