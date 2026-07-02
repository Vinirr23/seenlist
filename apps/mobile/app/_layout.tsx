import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// Estrutura mínima — sem tabs, sem telas de produto. Preparado só o
// suficiente para o Expo Router funcionar (TASK-001).
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
