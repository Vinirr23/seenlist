import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";

const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — mesmo limite do web (GIFs animados costumam ser bem maiores que fotos comuns)

/**
 * TASK-111/127 (seletor de imagem) — primeira vez que o app nativo
 * pede uma permissão de verdade ao sistema (galeria de fotos). Pede
 * explicitamente ANTES de abrir o seletor (em vez de deixar o
 * seletor pedir sozinho) — mesma recomendação oficial do Expo desde
 * o SDK 54, evita o usuário ficar surpreso com um diálogo do sistema
 * no meio do fluxo.
 *
 * Correção (TASK-127): tinha `quality: 0.85` — essa opção só faz
 * sentido pra JPEG; num GIF, o seletor recomprime o arquivo e perde
 * a animação (vira imagem estática). Removido — sem `quality`, o
 * arquivo original (JPEG, PNG ou GIF) é usado como veio, sem
 * recompressão nenhuma.
 */
export async function pickImageFromLibrary(): Promise<{ uri: string; mimeType: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" };
}

/** RN não tem o `File` da web — um `fetch(uri).blob()` local (`file://...`) é o jeito padrão de virar Blob pro upload no Supabase Storage. */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/** Idêntico a useAvatarUpload do web (mesmo bucket "avatars", mesmo destino duplo: user_metadata + profiles.avatar_url). */
export async function uploadAvatar(uri: string, mimeType: string): Promise<{ url: string | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Sessão expirada. Entre novamente." };

  try {
    const blob = await uriToBlob(uri);
    const path = `${user.id}/avatar-${Date.now()}.${extensionFromMimeType(mimeType)}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: mimeType });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: urlData.publicUrl } });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (profileError) {
      console.error("[imageUpload] Avatar salvo em user_metadata, mas falhou ao sincronizar em profiles", profileError);
    }

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('[imageUpload] Falha ao enviar avatar — confira se o bucket "avatars" existe no Supabase Storage.', error);
    return { url: null, error: "Não foi possível enviar a foto agora." };
  }
}

/** Idêntico a useBannerUpload do web (mesmo bucket "avatars", só separa por nome de arquivo — destino final é profiles.banner_url). */
export async function uploadBanner(uri: string, mimeType: string): Promise<{ url: string | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Sessão expirada. Entre novamente." };

  try {
    const blob = await uriToBlob(uri);
    const path = `${user.id}/banner-${Date.now()}.${extensionFromMimeType(mimeType)}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: mimeType });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: profileError } = await supabase.from("profiles").update({ banner_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (profileError) throw profileError;

    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('[imageUpload] Falha ao enviar banner — confira se o bucket "avatars" existe no Supabase Storage.', error);
    return { url: null, error: "Não foi possível enviar o banner agora." };
  }
}

/** Idêntico a usePostImageUpload do web (bucket "post-images" dedicado). Só faz upload — quem chama decide o que fazer com a URL (post de imagem). */
export async function uploadPostImage(uri: string, mimeType: string): Promise<{ url: string | null; error: string | null }> {
  if (!mimeType.startsWith("image/")) {
    return { url: null, error: "Só é possível anexar imagens ou GIFs." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Sessão expirada. Entre novamente." };

  try {
    const blob = await uriToBlob(uri);
    if (blob.size > MAX_POST_IMAGE_BYTES) {
      return { url: null, error: "Arquivo muito grande (máximo 8MB)." };
    }

    const path = `${user.id}/${Date.now()}.${extensionFromMimeType(mimeType)}`;
    const { error: uploadError } = await supabase.storage.from("post-images").upload(path, blob, { upsert: false, contentType: mimeType });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    return { url: urlData.publicUrl, error: null };
  } catch (error) {
    console.error('[imageUpload] Falha ao enviar imagem do post — confira se o bucket "post-images" existe no Supabase Storage.', error);
    return { url: null, error: "Não foi possível enviar a imagem agora." };
  }
}
