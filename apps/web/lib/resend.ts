import { env } from "@/lib/env";

const FROM_ADDRESS = "SeenList <onboarding@resend.dev>";

/**
 * TASK-077 — envio de e-mail via API REST do Resend, sem SDK novo
 * (é uma chamada `fetch` só, não compensa uma dependência inteira
 * pra isso). `FROM_ADDRESS` usa o remetente de teste do Resend
 * (`onboarding@resend.dev`) — funciona sem configuração de domínio,
 * mas com essa cara de "teste". Quando `seenlist.app` for verificado
 * no Resend (Domains → Add Domain), troca essa constante pra algo
 * como `SeenList <contato@seenlist.app>`.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[resend] Falha ao enviar e-mail", response.status, body);
      return { ok: false, error: `Resend respondeu ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error("[resend] Erro de rede ao enviar e-mail", error);
    return { ok: false, error: "Erro de rede" };
  }
}
