import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

/**
 * TASK-068 — o registro de push (`lib/pushNotifications.ts`,
 * TASK-052) que existia aqui ligado a `supabase.auth.onAuthStateChange`
 * saiu: com a "opção 1" (casca WebView carregando o site, ver
 * `app/index.tsx`), o login acontece DENTRO do site carregado — o
 * cliente Supabase nativo deste arquivo (`lib/supabase.ts`) nunca
 * recebe sessão nenhuma, então esse listener nunca dispararia de
 * verdade. Fica pra quando o app nativo de verdade for construído.
 *
 * `SafeAreaProvider` — necessário pro `SafeAreaView` usado em
 * `app/index.tsx` funcionar direito (evita a WebView desenhar por
 * baixo da barra de gestos do Android, cortando o fim das listas).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
