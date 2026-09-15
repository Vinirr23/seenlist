"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useMyProfile, useUpdateMyProfile } from "@/lib/queries/my-profile";
import { useAvatarUpload } from "@/lib/queries/avatar-upload";
import { useSetBannerFromLibrary } from "@/lib/queries/banner-upload";
import { updateName } from "@/lib/actions/account";
import { useToast } from "@/lib/toast/ToastProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { COUNTRIES } from "@/lib/countries";
import { Avatar } from "@/components/common/Avatar";
import { LibraryImagePickerModal } from "./LibraryImagePickerModal";

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
  const { setFromUrl: setBannerFromLibrary, pending: settingBannerFromLibrary } = useSetBannerFromLibrary();
  const [libraryPicker, setLibraryPicker] = useState<"banner" | null>(null);
  const updateProfile = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { t } = useTranslation();

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

  async function handleLibraryImageSelected(url: string) {
    setLibraryPicker(null);
    await setBannerFromLibrary(url);
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
    toast.success(t("settings.profileUpdated"));
    router.push("/profile");
  }

  if (!user || !profile) return null;

  return (
    <div className="relative w-full pb-24 md:mx-auto md:max-w-[430px]">
      {/*
        * CORREÇÃO (a pedido, 2026-09-15 — "a tela de editar perfil não
        * ganhou o design novo"). Mesma categoria de bug já corrigida
        * em `FeedbackView.tsx`/`NotificationsView.tsx` nesta mesma
        * leva — esta tela nunca teve campo de manchas nenhum (fundo
        * chapado). Mesmo campo de `MyCommentsPageView.tsx` (sub-telas
        * "voltar + título" iguais a esta).
        */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]" style={{ top: "40px", left: "-22%", background: "#1B4B7A" }} />
        <div className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]" style={{ top: "320px", right: "-20%", background: "#2A7FB8" }} />
        <div className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]" style={{ top: "620px", left: "-18%", background: "#0D3B5C" }} />
      </div>

      <div className="relative mb-6 flex items-center gap-2 px-4 pt-4">
        <Link
          href="/profile"
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t("settings.editProfile")}</h1>
      </div>

      <div className="relative -mt-2 mb-14 h-28 w-full bg-surface">
        {profile.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image
          <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
        {/*
          * REVERTIDO (a pedido, 2026-09-15 — mensagem com print de
          * referência: "tira a opção de selecionar capa pela galeria
          * de aparelho e abre direto esse sheet") — chegou a ganhar
          * dois botões (aparelho × biblioteca, "NOVO" nesta mesma
          * leva), mas o usuário pediu pra tirar de vez a opção de
          * aparelho pro banner: só resta o botão que abre
          * `LibraryImagePickerModal` direto.
          */}
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={() => setLibraryPicker("banner")}
            disabled={settingBannerFromLibrary}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-text shadow-lg shadow-black/25 backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-[0.96] disabled:opacity-50"
            style={{
              background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
            }}
          >
            {settingBannerFromLibrary ? t("settings.uploading") : t("settings.changeBanner")}
          </button>
        </div>

        {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
        <Avatar
          src={user.avatarUrl}
          name={user.name}
          className="absolute -bottom-10 left-4 h-20 w-20 border-4 border-background bg-surface"
          textClassName="text-xl"
        />
      </div>

      <div className="relative px-4">
        {/*
          * REVERTIDO (a pedido, 2026-09-15 — "na escolha de avatar
          * deixa pra a pessoa selecionar do celular como estava
          * antes") — chegou a ganhar um segundo botão (biblioteca,
          * "NOVO" nesta mesma leva), mas o usuário pediu de volta o
          * comportamento original: um botão só, seletor de arquivo do
          * navegador.
          */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-text backdrop-blur-[10px] backdrop-saturate-[160%] transition-transform active:scale-[0.96] disabled:opacity-50"
            style={{
              background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
            }}
          >
            {uploadingAvatar ? t("settings.uploading") : t("settings.changePhoto")}
          </button>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

        <div className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-xs text-muted">
              {t("settings.name")}
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
              {t("settings.username")}
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
              {t("settings.bio")}
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
              {t("settings.countryOptional")}
            </label>
            {/*
              * A PEDIDO — troca de campo de texto livre pra lista
              * fechada. Mesmo motivo do mobile: `check-new-releases`
              * (notificação de episódio novo) decide "isso é hoje?"
              * usando o fuso do país de cada pessoa — texto livre
              * ("Brasil"/"brazil"/"BR"/erro de digitação) exigia um
              * mapeamento cada vez mais frágil. `<select>` nativo do
              * navegador — mais simples que construir um dropdown
              * customizado, já vem com busca por teclado embutida.
              */}
            <select
              id="profile-country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-primary"
            >
              <option value="">{t("settings.countryPlaceholder")}</option>
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </option>
              ))}
              {/* Usuário antigo pode ter texto livre salvo de antes da troca — mostra como opção extra, pra não sumir/forçar troca sem querer, mas some sozinho assim que a pessoa escolher um país da lista. */}
              {!!country && !COUNTRIES.some((c) => c.value === country) && <option value={country}>{country}</option>}
            </select>
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
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>

      {libraryPicker && <LibraryImagePickerModal onSelect={handleLibraryImageSelected} onClose={() => setLibraryPicker(null)} />}
    </div>
  );
}
