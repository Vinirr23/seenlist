import { useEffect, useState } from "react";
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchEditableProfile, saveEditableProfile, setBannerFocalY as saveBannerFocalY } from "@/lib/editProfile";
import { pickImageFromLibrary, uploadAvatar, uploadBanner, setBannerFromTmdb } from "@/lib/imageUpload";
import { COUNTRIES } from "@/lib/countries";
import { Screen, Text, Button, Skeleton, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { CountryPicker } from "@/components/settings/CountryPicker";
import { LibraryImagePickerSheet } from "@/components/settings/LibraryImagePickerSheet";
import { BannerFocalYSlider } from "@/components/settings/BannerFocalYSlider";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-105/111 — porta completa de `EditProfileView.tsx` agora,
 * incluindo troca de foto/banner (que tinha ficado de fora por
 * depender do seletor de imagem, adicionado nesta mesma leva).
 *
 * CORREÇÃO (a pedido, 2026-09-15 — "a tela de editar perfil não
 * ganhou o design novo"). Causa raiz: mesma categoria de bug já
 * corrigida em `feedback.tsx`/`notifications.tsx` nesta mesma leva —
 * esta tela nunca teve `GlassTargetProvider`/`AmbientGlow` nenhum
 * (fundo chapado, sem o campo de manchas azul que o resto do app
 * tem). Mesmo `SUBPAGE_GLOW_BLOBS` de Comentários/Minhas listas/
 * Feedback — é o mesmo formato de sub-tela "voltar + título". Os
 * campos de texto em si continuam com o mesmo fundo sólido
 * (`colors.surface`) de sempre — o web (`EditProfileView.tsx`) também
 * usa `bg-surface` liso nos inputs, não vidro; o que faltava era só a
 * camada de fundo.
 *
 * NOVO (mesma leva, a pedido — "em alterar banner/foto, quero que
 * apareça opções de séries e filmes/personagens que o usuário já
 * marcou") — os botões "Alterar banner"/"Alterar foto" agora
 * perguntam a origem (galeria do aparelho × biblioteca) antes de
 * abrir o seletor — ver `handleChangeAvatar`/`handleChangeBanner` e
 * `LibraryImagePickerSheet.tsx`.
 */
export default function EditProfileScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  /**
   * NOVO (a pedido — "eu não consigo redimensionar o banner pra ficar
   * do jeito que eu quero") — ver `BannerFocalYSlider.tsx` e
   * `lib/editProfile.ts`. 0 = topo da foto, 0.5 = centro/padrão, 1 = base.
   */
  const [bannerFocalY, setBannerFocalY] = useState(0.5);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryPicker, setLibraryPicker] = useState<"banner" | null>(null);

  useEffect(() => {
    fetchEditableProfile()
      .then((profile) => {
        if (!profile) return;
        setName(profile.name);
        setUsername(profile.username);
        setBio(profile.bio);
        setCountry(profile.country);
        setAvatarUrl(profile.avatarUrl);
        setBannerUrl(profile.bannerUrl);
        setBannerFocalY(profile.bannerFocalY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handlePickFromDeviceAvatar() {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setUploadingAvatar(true);
    const result = await uploadAvatar(picked.uri, picked.mimeType);
    setUploadingAvatar(false);
    if (result.url) setAvatarUrl(result.url);
    else if (result.error) setError(result.error);
  }

  async function handlePickFromDeviceBanner() {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setUploadingBanner(true);
    const result = await uploadBanner(picked.uri, picked.mimeType);
    setUploadingBanner(false);
    if (result.url) {
      setBannerUrl(result.url);
      // `uploadBanner` já reseta `banner_focal_y: 0.5` no banco (ver
      // `lib/imageUpload.ts`) — este `setBannerFocalY` só mantém a UI
      // em sincronia com esse reset, sem escrita extra nenhuma.
      setBannerFocalY(0.5);
    } else if (result.error) setError(result.error);
  }

  /**
   * REVERTIDO (a pedido, 2026-09-15 — "na escolha de avatar deixa pra
   * a pessoa selecionar do celular como estava antes") — chegou a
   * ganhar a mesma escolha origem-do-aparelho×biblioteca do banner
   * nesta mesma leva ("NOVO" abaixo, mantido só pro banner), mas o
   * usuário pediu de volta o comportamento original: toca e já abre
   * direto a galeria do aparelho, sem pergunta nenhuma.
   */
  function handleChangeAvatar() {
    handlePickFromDeviceAvatar();
  }

  /**
   * NOVO (a pedido, 2026-09-15) — REVERTIDO EM PARTE logo em seguida
   * (mesma leva, "a mudança do sheet com opções, fica só no banner" +
   * a mensagem com print pedindo pra "tira a opção de selecionar capa
   * pela galeria de aparelho e abre direto esse sheet"): não pergunta
   * mais a origem (sem `Alert.alert`) — o botão "Alterar banner" abre
   * direto o sheet de busca da biblioteca. Only o avatar voltou a ser
   * 100% aparelho (ver `handleChangeAvatar` acima); o banner é o único
   * campo que mantém a escolha por biblioteca, e agora sem passar pela
   * galeria do aparelho de jeito nenhum.
   */
  function handleChangeBanner() {
    setLibraryPicker("banner");
  }

  async function handleLibraryImageSelected(url: string) {
    setLibraryPicker(null);
    setUploadingBanner(true);
    const result = await setBannerFromTmdb(url);
    setUploadingBanner(false);
    if (result.url) {
      setBannerUrl(result.url);
      // Mesmo motivo do handler acima — `setBannerFromTmdb` já reseta
      // `banner_focal_y: 0.5` no banco.
      setBannerFocalY(0.5);
    } else if (result.error) setError(result.error);
  }

  /**
   * `onChange` do slider: atualiza só o estado local (preview ao vivo
   * na própria tela, via `contentPosition` na `<Image>` abaixo) — SEM
   * chamar o Supabase. `onCommit` é quem realmente salva, e só dispara
   * quando o dedo solta a tela (ver comentário completo em
   * `BannerFocalYSlider.tsx`).
   */
  function handleBannerFocalYChange(next: number) {
    setBannerFocalY(next);
  }

  async function handleBannerFocalYCommit(next: number) {
    const result = await saveBannerFocalY(next);
    if (result.error) setError(result.error);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    const result = await saveEditableProfile({ name, username, bio, country });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.back();
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("profile.editProfile")}</Text>
      </View>

      {/*
        * CORREÇÃO (auditoria — achado real, mais grave que visual):
        * esta tela não tinha rolagem NENHUMA (`View` puro) nem
        * tratamento de teclado. Com banner + avatar + 4 campos +
        * botão, em aparelho de tela menor o botão "Salvar" ficava
        * inalcançável — e, com o teclado aberto, os campos de baixo
        * (Bio, País) ficavam cobertos, sem como rolar até eles.
        * `ScrollView` + `KeyboardAvoidingView` resolvem os dois.
        * `keyboardShouldPersistTaps="handled"` deixa tocar em
        * "Salvar" direto, sem precisar fechar o teclado antes.
        */}
      {/*
        * CORREÇÃO (auditoria — velocidade percebida) — enquanto
        * carregava, esta tela mostrava NADA (tela em branco), pior
        * que um spinner: parecia travada. Esqueleto no formato real
        * do conteúdo (banner, avatar, campos) faz a troca
        * "carregando → carregado" parecer instantânea, sem o layout
        * pular.
        */}
      <GlassTargetProvider style={styles.flex} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      {isLoading && (
        <View style={styles.content}>
          <Skeleton width="100%" height={112} />
          <Skeleton width={88} height={88} borderRadius={44} style={styles.skeletonAvatar} />
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonField}>
              <Skeleton width="30%" height={11} />
              <Skeleton width="100%" height={44} />
            </View>
          ))}
        </View>
      )}

      {!isLoading && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]} keyboardShouldPersistTaps="handled">
          <View style={styles.bannerWrapper}>
            {bannerUrl ? (
              <Image
                source={{ uri: bannerUrl }}
                style={styles.banner}
                contentFit="cover"
                // Preview ao vivo do ajuste do slider abaixo — mesma
                // técnica do `app/(tabs)/profile.tsx` (ver comentário lá).
                contentPosition={{ top: `${bannerFocalY * 100}%` }}
              />
            ) : (
              <View style={styles.bannerFallback} />
            )}
            <Pressable style={styles.bannerButton} onPress={handleChangeBanner} disabled={uploadingBanner}>
              <Text style={styles.bannerButtonText}>{uploadingBanner ? t("common.uploading") : t("profile.changeBanner")}</Text>
            </Pressable>

            <Avatar uri={avatarUrl} name={name || "?"} style={styles.avatarWrapper} textStyle={styles.avatarInitials} />
          </View>

          {!!bannerUrl && (
            <BannerFocalYSlider value={bannerFocalY} onChange={handleBannerFocalYChange} onCommit={handleBannerFocalYCommit} />
          )}

          <Pressable style={styles.avatarButton} onPress={handleChangeAvatar} disabled={uploadingAvatar}>
            <Feather name="camera" size={14} color={colors.text} />
            <Text style={styles.avatarButtonText}>{uploadingAvatar ? t("common.uploading") : t("profile.changePhoto")}</Text>
          </Pressable>

          <Field label={t("profile.name")} value={name} onChangeText={setName} />
          <Field
            label={t("profile.username")}
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ""))}
            prefix="@"
            autoCapitalize="none"
          />
          <Field label={t("profile.bio")} value={bio} onChangeText={setBio} multiline maxLength={280} />
          <Pressable style={styles.field} onPress={() => setShowCountryPicker(true)}>
            <Text variant="muted" style={styles.fieldLabel}>
              {t("profile.countryOptional")}
            </Text>
            <View style={styles.inputRow}>
              <Text style={country ? styles.countryValueText : styles.countryPlaceholderText}>
                {country ? countryDisplayLabel(country, t) : t("profile.countryPlaceholder")}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.muted} />
            </View>
          </Pressable>

          {!!error && <Text variant="error">{error}</Text>}

          <Button onPress={handleSave} loading={saving} disabled={!name.trim() || !username.trim()}>
            {t("common.save")}
          </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      </GlassTargetProvider>

      <CountryPicker value={country} onChange={setCountry} visible={showCountryPicker} onClose={() => setShowCountryPicker(false)} />
      {!!libraryPicker && <LibraryImagePickerSheet onSelect={handleLibraryImageSelected} onClose={() => setLibraryPicker(null)} />}
    </Screen>
  );
}

/**
 * Usuário antigo pode ter texto livre salvo de antes da troca pra
 * lista fixa (ex.: "brazil" minúsculo, "BR", erro de digitação) —
 * nesse caso, mostra o valor cru salvo, em vez de forçar um
 * país da lista nova ou deixar em branco. Só busca corresponder
 * exato com o valor canônico (ex.: "Brasil") pra mostrar o nome
 * traduzido; sem correspondência, mostra como está.
 */
function countryDisplayLabel(country: string, t: (key: string) => string): string {
  const match = COUNTRIES.find((c) => c.value === country);
  return match ? t(match.labelKey) : country;
}

function Field({
  label,
  value,
  onChangeText,
  prefix,
  multiline,
  maxLength,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  prefix?: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <Text variant="muted" style={styles.fieldLabel}>
        {label}
      </Text>
      <View style={[styles.inputRow, multiline && styles.inputRowMultiline]}>
        {!!prefix && <Text variant="muted">{prefix}</Text>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize ?? "sentences"}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
    </View>
  );
}

const AVATAR_SIZE = 80;

const styles = StyleSheet.create({
  countryValueText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  countryPlaceholderText: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  flex: {
    flex: 1,
  },
  skeletonAvatar: {
    alignSelf: "center",
    marginTop: -spacing.xl,
  },
  skeletonField: {
    gap: spacing.xs,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  // CORREÇÃO (2026-09-03) — `marginHorizontal` era `-spacing.lg` pra
  // cancelar exatamente o `paddingHorizontal` do `content` acima (a
  // capa sangra até a borda real do aparelho). Como o `content` virou
  // `spacing.md`, a margem negativa precisa acompanhar — senão a capa
  // ficaria descolada 8px da borda de tela.
  bannerWrapper: {
    height: 112,
    marginHorizontal: -spacing.md,
    marginBottom: AVATAR_SIZE / 2 + spacing.xs,
    backgroundColor: colors.surface,
  },
  banner: {
    width: "100%",
    height: "100%",
  },
  bannerFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surface,
  },
  bannerButton: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    backgroundColor: scrim.control,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  bannerButtonText: {
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.text,
  },
  // CORREÇÃO (2026-09-03) — `left` era `spacing.lg`; como a
  // `bannerWrapper` agora sangra até a borda real do aparelho (ver
  // acima), este `left` é o que efetivamente vira a borda de tela do
  // avatar — precisa acompanhar o resto pra alinhar com bio/nome/etc.
  avatarWrapper: {
    position: "absolute",
    left: spacing.md,
    bottom: -AVATAR_SIZE / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.muted,
  },
  avatarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  avatarButtonText: {
    fontSize: fontSize.xs,
    color: colors.text,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.xxs,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  inputRowMultiline: {
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
    paddingTop: spacing.xs,
  },
});
