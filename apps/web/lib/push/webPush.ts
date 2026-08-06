"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Web Push — inscrição do navegador pra receber aviso de episódio
 * novo sem precisar do app.
 *
 * Contexto da decisão (dado real do painel): D7 de 36% com app vs 4%
 * só site. A hipótese mais forte pra diferença é justamente o aviso
 * de episódio, que hoje só existe no app — e 81% da base está só no
 * site, sem app de iOS previsto.
 */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * O navegador exige a chave como bytes, não string.
 *
 * `ArrayBuffer` explícito (em vez do `Uint8Array` genérico) porque o
 * TypeScript recente distingue `ArrayBuffer` de `SharedArrayBuffer`,
 * e a API de push só aceita o primeiro.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Nem todo navegador suporta. Safari no iPhone só suporta DEPOIS de a
 * pessoa adicionar o site à tela de início — limitação do próprio
 * Safari. Por isso a interface precisa checar antes de oferecer, em
 * vez de mostrar um botão que não vai funcionar.
 */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPermissionState(): NotificationPermission | "unsupported" {
  if (!isWebPushSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Pede permissão e registra a inscrição no banco.
 *
 * Devolve um motivo em vez de só `false` porque a interface precisa
 * dizer coisas diferentes: "seu navegador não suporta" e "você
 * bloqueou nas configurações" exigem ações totalmente diferentes de
 * quem está lendo.
 */
export async function subscribeToWebPush(): Promise<
  { ok: true } | { ok: false; reason: "unsupported" | "denied" | "error"; detail?: string }
> {
  if (!isWebPushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "error", detail: "Chave VAPID não configurada." };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    /*
     * Se já existe inscrição neste navegador, reaproveita em vez de
     * criar outra — senão cada visita geraria uma linha nova e a
     * pessoa receberia a mesma notificação várias vezes.
     */
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "error", detail: "Inscrição incompleta." };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "error", detail: "Sessão não encontrada." };

    // `onConflict: endpoint` — o endpoint é o identificador real da
    // inscrição (a mesma pessoa pode ter uma por navegador).
    const { error } = await supabase.from("web_push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) return { ok: false, reason: "error", detail: error.message };

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "error", detail: error instanceof Error ? error.message : "Falha desconhecida." };
  }
}

/** Desinscreve no navegador E remove do banco — sem os dois, a pessoa continuaria recebendo. */
export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const supabase = createClient();
    await supabase.from("web_push_subscriptions").delete().eq("endpoint", endpoint);
    return true;
  } catch {
    return false;
  }
}

/** Já está inscrito NESTE navegador? (a permissão sozinha não basta — pode ter sido concedida e depois desinscrita) */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!isWebPushSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}
