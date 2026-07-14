import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * TASK-052 — registro de push do dispositivo. Fica pronto e testável
 * isoladamente, mas NÃO é chamado de nenhuma tela ainda: o app mobile
 * não tem login nem telas de produto (ver apps/mobile/app/index.tsx,
 * decisão deliberada da TASK-001 — "nenhuma tela de produto foi criada
 * aqui de propósito"). Sem usuário autenticado não tem em nome de quem
 * registrar o token. Chamar isto assim que existir uma tela pós-login:
 *
 *   const { data: { user } } = await supabase.auth.getUser();
 *   if (user) await registerForPushNotifications(supabase);
 *
 * Plataformas: iOS e Android via Expo push token nativo. Web usa um
 * caminho totalmente diferente (Service Worker + VAPID, API do
 * navegador, não o SDK do Expo) — fora do escopo deste helper; se o
 * suporte a Web Push for necessário, é uma implementação separada no
 * app Next.js, não uma extensão deste arquivo.
 *
 * IMPORTANTE — desde o Expo SDK 54, push notification NÃO funciona
 * mais dentro do Expo Go (só notificação local). Testar isto de
 * verdade exige um Development Build (`expo-dev-client`, que este
 * projeto já tem instalado) — não vai funcionar abrindo o app pelo
 * Expo Go normal, mesmo com tudo aqui implementado corretamente.
 */
export async function registerForPushNotifications(supabase: SupabaseClient): Promise<string | null> {
  if (Platform.OS === "web") {
    console.warn("[push] Web push não implementado neste helper — ver comentário acima.");
    return null;
  }

  if (!Device.isDevice) {
    console.warn("[push] Simuladores/emuladores não recebem push de verdade — pulando registro.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[push] Usuário negou permissão de notificação.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  /** TASK-135 — getSession() em vez de getUser() (mesmo motivo documentado em lib/supabase.ts: getUser() pode falhar com sessão ausente numa corrida logo na abertura do app, mesmo a sessão existindo de verdade). */
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) {
    console.warn("[push] Sem usuário autenticado — token obtido mas não registrado.");
    return null;
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";

  const { error } = await supabase
    .from("push_tokens")
    .upsert({ user_id: user.id, token, platform, last_seen_at: new Date().toISOString() }, { onConflict: "token" });

  if (error) {
    console.error("[push] Falha ao salvar token de push", error);
    return null;
  }

  return token;
}

/**
 * TASK-052 (integração) — chamado no logout. Remove só o token DESTE
 * dispositivo (obtido de novo via getExpoPushTokenAsync — é
 * determinístico pro mesmo device/instalação, não precisa ter sido
 * guardado em memória desde o registro). Se o dispositivo nunca
 * registrou (usuário negou permissão, por exemplo), não há nada pra
 * remover — não é erro.
 */
export async function removePushToken(supabase: SupabaseClient): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const { error } = await supabase.from("push_tokens").delete().eq("token", token);
    if (error) console.error("[push] Falha ao remover token no logout", error);
  } catch (error) {
    // getExpoPushTokenAsync pode falhar offline — não bloqueia o logout por causa disso.
    console.warn("[push] Não foi possível obter o token pra remover no logout", error);
  }
}

/**
 * Deep link recebido no `data.deepLink` do push (montado pela Edge
 * Function send-push-notifications) — usar com expo-router:
 *
 *   Notifications.addNotificationResponseReceivedListener((response) => {
 *     const deepLink = response.notification.request.content.data?.deepLink;
 *     if (typeof deepLink === "string") router.push(deepLink);
 *   });
 *
 * Não incluído como função pronta aqui porque depende do `router` de
 * expo-router, que só existe dentro de um componente/hook — colar
 * isso no _layout.tsx quando o app tiver rotas de produto.
 */
