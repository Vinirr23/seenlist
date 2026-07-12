import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";

/**
 * TASK-090 — substitui a WebView que existia aqui. Enquanto o
 * `AuthProvider` ainda não confirmou se existe uma sessão salva
 * (`loading`), mostra um spinner simples em vez de "piscar" pra tela
 * de login e depois pras abas. Depois disso, `<Redirect>` manda pro
 * lugar certo — sem histórico de navegação pra essa decisão em si
 * (o usuário não deveria conseguir "voltar" pra essa tela vazia).
 */
export default function IndexGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={session ? "/(tabs)/series" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
