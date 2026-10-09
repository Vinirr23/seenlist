import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

/**
 * Fica no topo do fluxo normal (não `position: absolute`) — mesma
 * decisão do web: quase toda tela tem seu próprio cabeçalho (botão
 * de voltar + título) logo no topo, um banner sobreposto cobriria
 * esse cabeçalho. Como este componente é montado uma vez só, na
 * raiz do app (`app/_layout.tsx`), acima de toda a navegação, ele
 * empurra a tela inteira pra baixo quando aparece — sem precisar de
 * nenhuma lógica extra por tela.
 *
 * CAUSA RAIZ (2026-10-09, reportado — "Ver todas as avaliações"
 * derrubando o app inteiro, direto pra tela inicial do celular, sem
 * passar pela tela "Algo deu errado" do `ErrorBoundary`) — este
 * arquivo era o ÚNICO lugar do app ainda usando o componente nativo
 * `<SafeAreaView>` (de `react-native-safe-area-context`) de verdade.
 * `Screen.tsx` e `LibraryImagePickerSheet.tsx` já documentam, cada
 * um no seu comentário, que esse componente nativo TRAVOU O APP COM
 * SIGSEGV nesta base de código antes — a regra desde então é
 * `useSafeAreaInsets()` + padding manual num `View` comum, nunca o
 * componente. Esta era a única exceção que ficou pra trás.
 *
 * Como este banner só existe montado quando `isOnline` é `false`
 * (abaixo), o crash não acontecia sempre — precisava da coincidência
 * de estar temporariamente "offline" (ex.: Wi-Fi fraco oscilando,
 * via `useOnlineStatus`/NetInfo) bem no instante em que uma nova
 * tela era empilhada por cima (ex.: tocar em "Ver todas as
 * avaliações"). Confirmado pelo print do próprio `ErrorBoundary`
 * desta vez (antes o crash era nativo demais pra ele capturar): a
 * pilha de componentes do erro mostrava exatamente
 * `RNSSafeAreaView`/`SafeAreaView` junto de `NavigationProvider` e
 * `ScreenContentWrapper` — a transição de tela colidindo com o
 * `SafeAreaView` nativo montado. Corrigido trocando pelo mesmo padrão
 * seguro já usado nos outros dois arquivos: `useSafeAreaInsets()`
 * entrega só o inset de cima (`insets.top`), somado como
 * `paddingTop` num `View` comum.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.wrapper}>
        <Feather name="wifi-off" size={14} color={colors.warning} strokeWidth={2} />
        <Text style={styles.text}>{t("offline.banner")}</Text>
      </View>
    </View>
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  text: {
    fontSize: fontSize.xxs,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center",
  },
});
