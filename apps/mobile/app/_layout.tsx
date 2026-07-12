import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";

/**
 * TASK-090 — fim da "opção 1" (casca WebView, ver histórico em
 * SEENLIST-SESSAO-2026-07-12.md). A partir daqui o app mobile é
 * nativo de verdade: `AuthProvider` dá a sessão do Supabase pro app
 * inteiro, e `app/index.tsx` decide pra onde mandar o usuário
 * (login ou abas) com base nela.
 *
 * `SafeAreaProvider` continua necessário — usado pelo hook
 * `useSafeAreaInsets()` em `components/ui/Screen.tsx` (não pelo
 * componente `SafeAreaView`, que já causou um crash SIGSEGV nesta
 * base de código).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style="light" />
          <Slot />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
