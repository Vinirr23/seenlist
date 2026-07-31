import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

/**
 * Fica no topo do fluxo normal (não `position: absolute`) — mesma
 * decisão do web: quase toda tela tem seu próprio cabeçalho (botão
 * de voltar + título) logo no topo, um banner sobreposto cobriria
 * esse cabeçalho. Como este componente é montado uma vez só, na
 * raiz do app (`app/_layout.tsx`), acima de toda a navegação, ele
 * empurra a tela inteira pra baixo quando aparece — sem precisar de
 * nenhuma lógica extra por tela. `SafeAreaView` (só a borda de cima)
 * cuida do notch/status bar sozinho, sem cálculo manual de inset.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();

  if (isOnline) return null;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.wrapper}>
        <Feather name="wifi-off" size={14} color={colors.warning} strokeWidth={2} />
        <Text style={styles.text}>{t("offline.banner")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "rgba(240, 180, 41, 0.15)",
  },
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(240, 180, 41, 0.4)",
  },
  text: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center",
  },
});
