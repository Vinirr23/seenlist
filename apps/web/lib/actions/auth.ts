"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = { error: string | null; message?: string };

function siteUrl() {
  // Preferimos a env explícita; em dev/preview sem ela configurada,
  // caímos pro host da Vercel quando existir.
  return process.env.NEXT_PUBLIC_SITE_URL ?? `https://${process.env.VERCEL_URL ?? "localhost:3000"}`;
}

/**
 * O middleware guarda pra onde o usuário tentava ir antes de cair no
 * login (`?redirectTo=/movies/123`), mas até esta revisão nada lia
 * esse valor — todo login caía em "/series" na marra, mesmo vindo de
 * um link direto pra uma página específica. Só aceita caminho interno
 * (`/algo`) — nunca uma URL absoluta ou `//`, que seria um
 * open-redirect (mandar o usuário autenticado pra um site de
 * terceiros usando o próprio SeenList como isca).
 */
function safeRedirectPath(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/series";
}

/** Login por e-mail/senha. */
export async function signInWithEmail(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  redirect(safeRedirectPath(formData.get("redirectTo")));
}

/** Cadastro por e-mail/senha. */
export async function signUpWithEmail(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }
  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error) {
    console.error("[signup] Falha ao criar conta", error);

    return {
      error:
        error.message === "User already registered" ? "Este e-mail já tem cadastro." : "Não foi possível criar a conta.",
    };
  }

  // Se a confirmação de e-mail estiver habilitada no projeto Supabase,
  // `session` vem nulo aqui — o usuário precisa confirmar antes de logar.
  if (!data.session) {
    return {
      error: null,
      message: "Cadastro criado. Confirme seu e-mail para poder entrar.",
    };
  }

  redirect("/series");
}

/**
 * Login com Google — pega a URL de autorização do Supabase e
 * redireciona pra ela.
 *
 * TASK-079 — o Google bloqueia esse login inteiro dentro de
 * qualquer WebView genérica (erro "disallowed_useragent") —
 * inclusive a nossa, a do app mobile (`apps/mobile/app/index.tsx`
 * dá um User-Agent próprio, com "SeenListApp" no final, só pra essa
 * detecção). Quando detectado, marca `&mobile=1` no callback — é o
 * `/auth/callback` que decide o que fazer com isso (ver
 * route.ts), não esta função.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const redirectPath = safeRedirectPath(formData.get("redirectTo"));
  const headersList = await headers();
  const isMobileApp = headersList.get("user-agent")?.includes("SeenListApp") ?? false;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(redirectPath)}${isMobileApp ? "&mobile=1" : ""}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}

/** Envia o e-mail de recuperação de senha. */
export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Informe seu e-mail." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/forgot-password`,
  });

  // Não revelamos se o e-mail existe ou não (evita enumeração de contas) —
  // sempre respondemos com a mesma mensagem de sucesso.
  if (error) {
    return { error: "Não foi possível enviar o e-mail agora. Tente de novo em instantes." };
  }

  return { error: null, message: "Se esse e-mail tiver conta, enviamos um link de recuperação." };
}

/** Define a nova senha — só funciona com uma sessão de recuperação ativa. */
export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "A senha precisa ter pelo menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Não foi possível atualizar a senha. Peça um novo link de recuperação." };
  }

  redirect("/series");
}

/** Logout. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
