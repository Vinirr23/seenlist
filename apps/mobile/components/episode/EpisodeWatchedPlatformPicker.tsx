import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { hapticSelection } from "@/lib/haptics";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-115 (episódio) — porta de EpisodeWatchedPlatformPicker.tsx.
 * Os streamings reais vêm do mesmo `watchProviders` que a tela de
 * filme já usa (nenhuma consulta nova ao TMDB) — "Outro" e "Não
 * oficial" são opções fixas que sempre aparecem.
 */
export function EpisodeWatchedPlatformPicker({
  providers,
  value,
  onChange,
}: {
  providers: WatchProvider[];
  value: string | null;
  onChange: (platform: string | null) => void;
}) {
  const { t } = useTranslation();
  const FIXED_OPTIONS = [
    { key: "other", label: t("episode.platformOther"), icon: "more-horizontal" as const },
    { key: "unofficial", label: t("episode.platformUnofficial"), icon: "shield-off" as const },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {providers.map((provider) => {
        const logoUrl = tmdbImageUrl(provider.logoPath, "w185");
        const selected = value === provider.name;
        return (
          <Pressable
            key={provider.id}
            style={styles.item}
            onPress={() => {
              hapticSelection();
              onChange(selected ? null : provider.name);
            }}
          >
            <View style={[styles.iconWrapper, selected && styles.iconWrapperActive]}>
              {logoUrl && <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />}
            </View>
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>
              {provider.name}
            </Text>
          </Pressable>
        );
      })}

      {FIXED_OPTIONS.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            style={styles.item}
            onPress={() => {
              hapticSelection();
              onChange(selected ? null : option.key);
            }}
          >
            <View style={[styles.iconWrapper, styles.iconWrapperOutline, selected && styles.iconWrapperActive]}>
              <Feather name={option.icon} size={18} color={selected ? colors.primary : colors.muted} />
            </View>
            <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  item: {
    width: 64,
    alignItems: "center",
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconWrapperOutline: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.border,
  },
  iconWrapperActive: {
    borderColor: colors.primary,
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  /**
   * MESMO PADRÃO ACHADO EM `SlidingTabs.tsx` (2026-09-16, mesma
   * varredura — "procure por outros desalinhamentos") — `label`
   * (peso padrão do `Text`, 400) e `labelActive` (peso 600) usam
   * arquivos de fonte diferentes (`PlusJakartaSans_400Regular` vs
   * `_600SemiBold`), sem `lineHeight` travado; ver o comentário
   * completo lá. `14` é o padrão comum pra `fontSize.micro` (10) no
   * resto do app (`1.4×`).
   */
  label: {
    marginTop: spacing.xs,
    fontSize: fontSize.micro,
    lineHeight: 14,
    color: colors.muted,
    textAlign: "center",
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "600",
    lineHeight: 14,
  },
});
