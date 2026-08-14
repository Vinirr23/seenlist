// supabase/functions/send-push-notifications/webPush.ts
//
// Envio de Web Push (navegador). Complementa o envio pro Expo (app)
// que já existia — não substitui: quem tem o app continua recebendo
// por lá, quem usa só o site passa a receber por aqui.
//
// POR QUE ISSO EXISTE (dado real do painel): retenção D7 de 36% com
// app vs 4% só site. O aviso de episódio novo é a diferença mais
// provável, e 81% da base está só no site — sem app de iOS previsto,
// esse é o único caminho pra maior parte dos usuários.
//
// Web Push é bem mais trabalhoso que o Expo porque a mensagem é
// CIFRADA DE PONTA A PONTA: nem o serviço de push do navegador
// (Google/Mozilla/Apple) consegue ler o conteúdo. Isso exige:
//   1. Assinar um token JWT com a chave VAPID (prova que o envio veio
//      mesmo do nosso servidor).
//   2. Cifrar o corpo com as chaves que o navegador gerou (`p256dh` e
//      `auth`), usando o esquema `aes128gcm`.
// Tudo feito com a API de criptografia nativa do Deno — sem
// dependência externa.

export interface WebPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:contato@seenlist.app";

function base64UrlToBytes(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

/** Importa a chave privada VAPID (formato JWK) pra assinar o JWT. */
async function importVapidPrivateKey(): Promise<CryptoKey> {
  const publicBytes = base64UrlToBytes(VAPID_PUBLIC_KEY);
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: VAPID_PRIVATE_KEY,
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

/**
 * Monta o token JWT que prova ao serviço de push que a mensagem veio
 * do nosso servidor. Vale 12 horas — o padrão permite até 24, mas
 * menos tempo reduz a janela caso algum token vaze em log.
 */
async function buildVapidJwt(audience: string): Promise<string> {
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: VAPID_SUBJECT,
      })
    )
  );

  const key = await importVapidPrivateKey();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  return `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/** Derivação de chave (HKDF), exigida pelo esquema `aes128gcm`. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Cifra o corpo da mensagem com as chaves do navegador (aes128gcm). */
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ body: Uint8Array }> {
  const clientPublicKey = base64UrlToBytes(p256dhBase64);
  const authSecret = base64UrlToBytes(authBase64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Par de chaves efêmero — novo a cada mensagem, por design do padrão.
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256)
  );

  const encoder = new TextEncoder();
  const prkInfo = concat(
    encoder.encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicRaw
  );
  const ikm = await hkdf(authSecret, sharedSecret, prkInfo, 32);

  const contentEncryptionKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", contentEncryptionKey, "AES-GCM", false, ["encrypt"]);
  // O `0x02` no fim marca o último registro (o padrão prevê vários).
  const plaintext = concat(encoder.encode(payload), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext)
  );

  // Cabeçalho: salt (16) + tamanho do registro (4) + tamanho da
  // chave (1) + chave pública do servidor (65).
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  const header = concat(salt, recordSize, new Uint8Array([serverPublicRaw.length]), serverPublicRaw);

  return { body: concat(header, ciphertext) };
}

export interface WebPushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/**
 * Envia pra UMA inscrição. Devolve `expired: true` quando o
 * navegador avisa que a inscrição não vale mais (404/410) — quem
 * chama usa isso pra limpar a linha do banco, senão a tabela vai
 * enchendo de inscrição morta e cada rodada fica mais lenta à toa.
 */
export async function sendWebPush(
  subscription: WebPushSubscription,
  message: WebPushMessage
): Promise<{ ok: boolean; expired: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("[webPush] Chaves VAPID não configuradas — envio web ignorado.");
    return { ok: false, expired: false, error: "VAPID keys not configured" };
  }

  try {
    const url = new URL(subscription.endpoint);
    const jwt = await buildVapidJwt(`${url.protocol}//${url.host}`);
    const { body } = await encryptPayload(JSON.stringify(message), subscription.p256dh, subscription.auth);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400", // guarda por 24h se o aparelho estiver offline
      },
      body,
    });

    if (response.status === 404 || response.status === 410) return { ok: false, expired: true, error: `HTTP ${response.status}` };
    if (!response.ok) {
      console.error(`[webPush] Falha ${response.status} em ${url.host}`);
      return { ok: false, expired: false, error: `HTTP ${response.status} (${url.host})` };
    }
    return { ok: true, expired: false };
  } catch (error) {
    console.error("[webPush] Erro ao enviar", error);
    return { ok: false, expired: false, error: error instanceof Error ? error.message : String(error) };
  }
}
