import { useCallback, useEffect, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchUnreadNotificationCount } from "@/lib/notifications";
import { Text, Glass } from "@/components/ui";
import { colors } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO (2026-09-15 — "do lado esquerdo, implementa um botão com
 * um sino de notificações, para toda notificação aparecer nele").
 * Mesmo botão "vidro sobre imagem" que os ícones de editar/
 * compartilhar/configurações já usavam (`bannerIconGlass`/
 * `bannerIconButton`/`bannerIconButtonFlat`, `profile.tsx`), agora do
 * lado esquerdo, com bolinha vermelha quando existe notificação não
 * lida — recarrega ao voltar o foco pra tela (`useFocusEffect`, mesmo
 * padrão de `recommendations.tsx`) e a cada 60s enquanto a tela está
 * em foco, já que não existe assinatura em tempo real pra esta
 * entrega (registrado como simplificação conhecida).
 */
export function NotificationBell({ flat }: { flat?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);

  const reload = useCallback(() => {
    fetchUnreadNotificationCount().then(setUnreadCount);
  }, []);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  useEffect(() => {
    const interval = setInterval(reload, 60_000);
    return () => clearInterval(interval);
  }, [reload]);

  /*
   * A PEDIDO (2026-09-16 — "coloca o mesmo efeito de 'seguindo,
   * seguidos e comentários' no sino e no (...)"). Trocado pra `pill`
   * primeiro — não resolveu (ver correção abaixo).
   *
   * CORREÇÃO (2026-09-16, mesmo dia — "corrige o sino e o (...) que
   * ainda estão iluminados, verifique a causa raiz"): medido por pixel
   * (print real) que a causa NUNCA foi o `saturate` (removido com a
   * troca pra `pill`, disco continuou "aceso"). A causa real é a
   * opacidade de `base`/`highlight` da receita, calibrada pra pílula
   * sobre fundo escuro sólido, sendo forte demais sobre a foto de capa
   * (mais clara) num disco pequeno e redondo — ver a receita nova
   * `bannerIcon` em `lib/theme.ts`, com a medição completa.
   */
  const glassVariant = flat ? undefined : "bannerIcon";

  return (
    /*
     * CORREÇÃO (a pedido, 2026-09-15, print real — "o número tá
     * cortado dentro do botão do sino") — a bolinha vermelha era
     * FILHA do `Glass`, posicionada parcialmente fora dos 36×36px do
     * botão (`top: -2, right: -2`). `Glass` usa `overflow: "hidden"`
     * na caixa de fora (pra recortar o desfoque certinho nas bordas
     * arredondadas — ver `components/ui/Glass.tsx`), então ele também
     * recortava um pedaço do número. Fix: a bolinha virou IRMÃ do
     * `Glass`, filha direta deste `Pressable` (que não tem `overflow`
     * nenhum) — mesma posição visual, mas fora da área que o vidro
     * recorta.
     */
    <Pressable hitSlop={8} accessibilityLabel={t("profile.notifications")} onPress={() => router.push("/notifications")}>
      <Glass variant={glassVariant} style={flat ? styles.buttonFlat : styles.button}>
        <Feather name="bell" size={16} color={flat ? colors.muted : colors.text} />
      </Glass>
      {unreadCount > 0 && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonFlat: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 12,
  },
});
