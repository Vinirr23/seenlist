import { useEffect, useState } from "react";
import { View, Image, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchEditableProfile, saveEditableProfile } from "@/lib/editProfile";
import { pickImageFromLibrary, uploadAvatar, uploadBanner } from "@/lib/imageUpload";
import { Screen, Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

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
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
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
        <Text variant="subtitle">Editar perfil</Text>
      </View>

      {!isLoading && (
        <View style={styles.content}>
          <View style={styles.bannerWrapper}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.banner} resizeMode="cover" />
            ) : (
              <View style={styles.bannerFallback} />
            )}
            <Pressable style={styles.bannerButton} onPress={handleChangeBanner} disabled={uploadingBanner}>
              <Text style={styles.bannerButtonText}>{uploadingBanner ? "Enviando…" : "Alterar banner"}</Text>
            </Pressable>

            <View style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarInitials}>{initials(name || "?")}</Text>
              )}
            </View>
          </View>

          <Pressable style={styles.avatarButton} onPress={handleChangeAvatar} disabled={uploadingAvatar}>
            <Feather name="camera" size={14} color={colors.text} />
            <Text style={styles.avatarButtonText}>{uploadingAvatar ? "Enviando…" : "Alterar foto"}</Text>
          </Pressable>

          <Field label="Nome" value={name} onChangeText={setName} />
          <Field
            label="Username"
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ""))}
            prefix="@"
            autoCapitalize="none"
          />
          <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={280} />
          <Field label="País (opcional)" value={country} onChangeText={setCountry} placeholder="Brasil" />

          {!!error && <Text variant="error">{error}</Text>}

          <Button onPress={handleSave} loading={saving} disabled={!name.trim() || !username.trim()}>
            Salvar
          </Button>
        </View>
      )}
    </Screen>
  );
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bannerWrapper: {
    height: 112,
    marginHorizontal: -spacing.lg,
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
    backgroundColor: "rgba(11,14,20,0.75)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  bannerButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
  },
  avatarWrapper: {
    position: "absolute",
    left: spacing.lg,
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
    fontSize: 12,
    color: colors.text,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontSize: 11,
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
