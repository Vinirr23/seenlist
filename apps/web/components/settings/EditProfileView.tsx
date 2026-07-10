"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useMyProfile, useUpdateMyProfile } from "@/lib/queries/my-profile";
import { useAvatarUpload } from "@/lib/queries/avatar-upload";
import { useBannerUpload } from "@/lib/queries/banner-upload";
import { updateName } from "@/lib/actions/account";
import { useToast } from "@/lib/toast/ToastProvider";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-026A + TASK-028, item 9: "centralizar todas as edições numa
 * única tela... não espalhar em vários menus". Nome e foto já
 * moravam aqui; username, banner, bio e país entram na mesma tela,
 * não em uma nova.
 *
 * Duas mutações independentes (nome via `updateName`/user_metadata,
 * username+bio+país via `useUpdateMyProfile`/tabela `profiles`) —
 * salvas juntas quando o usuário aperta "Salvar", uma única ação do
 * ponto de vista de quem usa, mesmo sendo dois destinos por trás.
 */
export function EditProfileView() {
  const { data: user } = useCurrentUser();
  const { data: profile } = useMyProfile();
  const { upload: uploadAvatar, pending: uploadingAvatar } = useAvatarUpload();
  const { upload: uploadBanner, pending: uploadingBanner } = useBannerUpload();
  const updateProfile = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Nome e perfil chegam de duas queries separadas, em momentos
  // diferentes — sincroniza o formulário uma vez só, quando os dois
  // já carregaram, nunca direto no corpo do componente.
  useEffect(() => {
    if (user && profile && !initialized) {
      setName(user.name);
      setUsername(profile.username);
      setBio(profile.bio ?? "");
      setCountry(profile.country ?? "");
      setInitialized(true);
    }
  }, [user, profile, initialized]);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await uploadAvatar(file);
    event.target.value = "";
  }

  async function handleBannerChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) await uploadBanner(file);
    event.target.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const nameResult = await updateName(name);
    if (nameResult.error) {
      setSaving(false);
      setError(nameResult.error);
      return;
    }

    const profileResult = await updateProfile.mutate({
      username: username.trim(),
      bio: bio.trim() || null,
      country: country.trim() || null,
    });
    setSaving(false);
    if (profileResult.error) {
      setError(profileResult.error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["current-user"] });
    toast.success("Perfil atualizado");
    router.push("/profile");
  }

  if (!user || !profile) return null;

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="mb-6 flex items-center gap-2 px-4 pt-4">
        <Link
          href="/profile"
          aria-label="Voltar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">Editar Perfil</h1>
      </div>

      <div className="relative -mt-2 mb-14 h-28 w-full bg-surface">
        {profile.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image
          <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={uploadingBanner}
          className="absolute right-3 top-3 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-text backdrop-blur transition-transform active:scale-[0.96] disabled:opacity-50"
        >
          {uploadingBanner ? "Enviando…" : "Alterar banner"}
        </button>
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />

        <div className="absolute -bottom-10 left-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-surface">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image
            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-semibold text-muted">{initials(user.name)}</span>
          )}
        </div>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="mb-6 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-transform active:scale-[0.96] disabled:opacity-50"
        >
          {uploadingAvatar ? "Enviando…" : "Alterar foto"}
        </button>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-xs text-muted">
              Nome
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="profile-username" className="mb-1 block text-xs text-muted">
              Username
            </label>
            <div className="flex items-center rounded-lg border border-border bg-surface px-3 focus-within:border-primary">
              <span className="text-sm text-muted">@</span>
              <input
                id="profile-username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s/g, ""))}
                className="w-full bg-transparent py-2.5 pl-1 text-sm text-text outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-bio" className="mb-1 block text-xs text-muted">
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={3}
              maxLength={280}
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="profile-country" className="mb-1 block text-xs text-muted">
              País (opcional)
            </label>
            <input
              id="profile-country"
              type="text"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="Brasil"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || name.trim().length === 0 || username.trim().length === 0}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-background transition-transform active:scale-[0.96] disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
