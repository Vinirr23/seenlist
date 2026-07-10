import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import { registerForPushNotifications, removePushToken } from "../lib/pushNotifications";

// Estrutura mínima — sem tabs, sem telas de produto. Preparado só o
// suficiente para o Expo Router funcionar (TASK-001).
//
// TASK-052 (integração) — `onAuthStateChange` cobre os 3 gatilhos
// pedidos sem precisar de nenhuma tela nova:
//   - INITIAL_SESSION com sessão presente = sessão restaurada ao abrir o app;
//   - SIGNED_IN = login (email/senha, Google, o que vier a existir);
//   - SIGNED_OUT = logout.
// O pedido de permissão de notificação só acontece DENTRO de
// registerForPushNotifications, chamada aqui só depois de confirmar
// que existe uma sessão real — nunca no boot do app antes de saber
// se há usuário autenticado. Não dá pra adiar mais que isso sem uma
// tela de produto real pra decidir "o momento certo" (ex.: depois do
// usuário ver uma notificação relevante) — isso é decisão de produto,
// não algo que dá pra inventar aqui.
export default function RootLayout() {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void removePushToken(supabase);
        return;
      }
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        void registerForPushNotifications(supabase);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
