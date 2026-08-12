import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";
import { ONBOARDING_SEEN_KEY } from "@/app/(auth)/onboarding";

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
 *
 * A PEDIDO — onboarding de uma tela, mostrado só na primeira
 * abertura. Duas checagens independentes precisam terminar antes de
 * decidir pra onde navegar: a de sessão (já existia) e a de "já viu
 * o onboarding" (nova, `AsyncStorage`) — por isso `loading` agora
 * combina os dois (`authLoading || onboardingLoading`), não só o da
 * sessão. Sem essa segunda checagem, todo mundo (inclusive quem já
 * usa o app) veria brevemente o splash resolver "sem sessão" e só
 * depois decidir — a checagem do onboarding é praticamente
 * instantânea (leitura local), mas ainda assim é assíncrona.
 */
export default function IndexGate() {
  const { session, loading: authLoading } = useAuth();
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then((value) => setOnboardingSeen(value === "1"));
  }, []);

  const loading = authLoading || onboardingSeen === null;

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image source={require("@/assets/images/splash-logo.png")} style={styles.logo} contentFit="contain" />
      </View>
    );
  }

  if (session) return <Redirect href="/(tabs)/series" />;
  return <Redirect href={onboardingSeen ? "/(auth)/login" : "/(auth)/onboarding"} />;
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
