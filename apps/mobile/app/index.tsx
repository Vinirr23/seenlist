import { View, Image, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";

/**
 * TASK-165 (splash screen) — versão original tinha 3 segundos FIXOS
 * de propósito, mesmo com a sessão já resolvida. Removido a pedido:
 * agora navega assim que `useAuth()` souber se existe sessão salva
 * (`loading` vira false), sem espera artificial — a splash nativa
 * (`app.json`, plugin `expo-splash-screen`, mesma logo/fundo) já
 * cobre o tempo real de carregamento do JS antes disso; esta view
 * continua existindo só pra não ter nenhum "gap" (tela em branco ou
 * flash) entre a splash nativa sumir e o `useAuth()` terminar de
 * checar a sessão local — na prática dura uma fração de segundo,
 * não os 3s fixos de antes.
 */
export default function IndexGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image source={require("@/assets/images/splash-logo.png")} style={styles.logo} resizeMode="contain" />
      </View>
    );
  }

  return <Redirect href={session ? "/(tabs)/series" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  logo: {
    width: 160,
    height: 128,
  },
});
