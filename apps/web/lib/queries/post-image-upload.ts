"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — GIFs animados costumam ser bem maiores que fotos comuns.

/**
 * TASK-066 — mesmo padrão de `comment-image-upload.ts` (bucket
 * dedicado, path com o id do usuário, URL pública de volta). Bucket
 * separado ("post-images", não "comment-images") — cada feature com
 * o próprio bucket, mesma convenção de "avatars"/"banners".
 */
export function usePostImageUpload() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<string | null> {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Só é possível anexar imagens ou GIFs.");
      return null;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Arquivo muito grande (máximo 8MB).");
      return null;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const extension = file.name.split(".").pop() ?? (file.type === "image/gif" ? "gif" : "jpg");
      const path = `${user.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (uploadError) {
      console.error(
        '[posts] Falha ao enviar imagem do post — confira se o bucket "post-images" existe no Supabase Storage.',
        uploadError
      );
      setError("Não foi possível enviar a imagem agora.");
      return null;
    } finally {
      setPending(false);
    }
  }

  return { upload, pending, error, clearError: () => setError(null) };
}
