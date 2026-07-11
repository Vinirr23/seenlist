import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/resend";

const MAX_EMAILS_PER_REQUEST = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** TASK-077 (correção) — plano gratuito do Resend aceita ~2 envios/segundo; 600ms entre cada um fica com folga, evita erro 429 (limite excedido). */
const DELAY_BETWEEN_SENDS_MS = 600;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PLAY_STORE_TEST_LINK = "https://play.google.com/apps/internaltest/4701756967789045864";
const SUBJECT = "SeenList — seu acesso ao teste beta chegou!";

/**
 * TASK-077 (correção) — o convite não leva mais de volta pra
 * `seenlist.app/beta` (isso já foi feito, é quem PREENCHEU esse
 * formulário que recebe este e-mail agora) — leva pro link de opt-in
 * do teste interno da Play Store, o único jeito de virar testador de
 * verdade (ver conversa sobre "O item não foi encontrado").
 */
function buildEmailHtml(): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0B0E14; padding:32px; color:#F4F1E8;">
      <div style="max-width:420px; margin:0 auto;">
        <p style="font-size:13px; letter-spacing:0.1em; text-transform:uppercase; color:#8C93A8; margin:0 0 16px;">SeenList</p>
        <h1 style="font-size:26px; line-height:1.2; margin:0 0 12px;">
          Seu acesso à <span style="color:#E8A33D;">beta chegou!</span>
        </h1>
        <p style="font-size:14px; line-height:1.6; color:#8C93A8; margin:0 0 24px;">
          Valeu por entrar na lista de espera do SeenList. Toque no botão abaixo pra virar testador oficial — depois disso, é só abrir a Play Store e instalar o app.
        </p>
        <a href="${PLAY_STORE_TEST_LINK}" style="display:inline-block; background:#E8A33D; color:#0B0E14; font-weight:700; text-decoration:none; padding:14px 24px; border-radius:10px; font-size:14px;">
          Virar testador e instalar
        </a>
        <p style="font-size:12px; color:#8C93A8; margin-top:32px;">Disponível para Android. seenlist.app</p>
      </div>
    </div>
  `;
}

/**
 * TASK-077 — convite em massa pro teste da Play Store, pra quem já
 * deixou o e-mail em `/beta`. Só o dono do projeto consegue disparar
 * isso — comparado no servidor (`env.adminEmail()`), a chave do
 * Resend nunca é exposta ao cliente. `/admin/invite` (a tela que
 * chama esta rota) já faz a mesma checagem antes de mostrar o
 * formulário, mas a checagem que importa de verdade é esta aqui — a
 * tela é só conveniência.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== env.adminEmail()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  let body: { emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const rawEmails = Array.isArray(body.emails) ? body.emails : [];
  const emails = [...new Set(rawEmails.filter((e): e is string => typeof e === "string" && EMAIL_PATTERN.test(e.trim())).map((e) => e.trim()))].slice(
    0,
    MAX_EMAILS_PER_REQUEST
  );

  if (emails.length === 0) {
    return NextResponse.json({ error: "Nenhum e-mail válido encontrado." }, { status: 400 });
  }

  const html = buildEmailHtml();
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < emails.length; i++) {
    const result = await sendEmail({ to: emails[i], subject: SUBJECT, html });
    results.push(result.ok ? { email: emails[i], ok: true } : { email: emails[i], ok: false, error: result.error });
    if (i < emails.length - 1) await delay(DELAY_BETWEEN_SENDS_MS);
  }

  return NextResponse.json({ results });
}

/** TASK-077 (correção) — lista quem já preencheu `/beta`. A sessão do usuário só confirma QUEM está pedindo (precisa ser `env.adminEmail()`); a consulta em si usa `createAdminClient()` (chave de serviço), porque `beta_signups` não tem — nem devia ter — uma policy de SELECT liberada nem pro próprio dono via RLS comum. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== env.adminEmail()) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("beta_signups")
    .select("email, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin/send-beta-invite] Falha ao listar beta_signups", error);
    return NextResponse.json({ error: "Não foi possível buscar a lista agora." }, { status: 500 });
  }

  return NextResponse.json({ signups: data ?? [] });
}
