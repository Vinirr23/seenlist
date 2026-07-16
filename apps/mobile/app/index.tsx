import { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";

const SPLASH_DURATION_MS = 3000;

/**
 * TASK-165 (splash screen) — antes disso, `IndexGate` só mostrava um
 * spinner enquanto `useAuth()` ainda não sabia se existe sessão
 * salva (`loading`), e sumia assim que resolvesse — às vezes bem
 * rápido, sem dar tempo de ver nada. A pedido: 3 segundos FIXOS com
 * a logo, sempre, mesmo se a sessão resolver antes disso (o
 * carregamento continua rodando por trás durante esses 3s, só não
 * navega até o tempo passar). Se a sessão demorar mais que 3s por
 * algum motivo raro (rede lenta), a splash continua até resolver de
 * verdade — não dá pra decidir a rota certa (Séries vs Login) sem
 * saber se existe sessão, então isso é uma proteção, não o caminho
 * esperado.
 *
 * `session`/`loading` de `useAuth()` são lidos aqui só depois do
 * temporizador, mas o hook em si já roda (e a restauração de sessão
 * já acontece) desde o primeiro render — o `AuthProvider` fica acima
 * deste componente na árvore (`_layout.tsx`), então nada fica
 * esperando os 3s pra começar.
 */
export default function IndexGate() {
  const { session, loading } = useAuth();
  const [splashTimeElapsed, setSplashTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashTimeElapsed(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!splashTimeElapsed || loading) {
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
