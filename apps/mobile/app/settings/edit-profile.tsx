import { useEffect, useState } from "react";
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchEditableProfile, saveEditableProfile } from "@/lib/editProfile";
import { pickImageFromLibrary, uploadAvatar, uploadBanner } from "@/lib/imageUpload";
import { COUNTRIES } from "@/lib/countries";
import { Screen, Text, Button, Skeleton } from "@/components/ui";
import { CountryPicker } from "@/components/settings/CountryPicker";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-105/111 — porta completa de `EditProfileView.tsx` agora,
 * incluindo troca de foto/banner (que tinha ficado de fora por
 * depender do seletor de imagem, adicionado nesta mesma leva).
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function handleChangeAvatar() {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setUploadingAvatar(true);
    const result = await uploadAvatar(picked.uri, picked.mimeType);
    setUploadingAvatar(false);
    if (result.url) setAvatarUrl(result.url);
    else if (result.error) setError(result.error);
  }

  async function handleChangeBanner() {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setUploadingBanner(true);
    const result = await uploadBanner(picked.uri, picked.mimeType);
    setUploadingBanner(false);
    if (result.url) setBannerUrl(result.url);
    else if (result.error) setError(result.error);
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
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.bannerWrapper}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.banner} contentFit="cover" />
            ) : (
              <View style={styles.bannerFallback} />
            )}
            <Pressable style={styles.bannerButton} onPress={handleChangeBanner} disabled={uploadingBanner}>
              <Text style={styles.bannerButtonText}>{uploadingBanner ? t("common.uploading") : t("profile.changeBanner")}</Text>
            </Pressable>

            <View style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarInitials}>{initials(name || "?")}</Text>
              )}
            </View>
          </View>

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

      <CountryPicker value={country} onChange={setCountry} visible={showCountryPicker} onClose={() => setShowCountryPicker(false)} />
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
