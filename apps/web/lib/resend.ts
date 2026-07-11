import { env } from "@/lib/env";

const FROM_ADDRESS = "SeenList <contato@seenlist.app>";

/**
 * TASK-077 — envio de e-mail via API REST do Resend, sem SDK novo
 * (é uma chamada `fetch` só, não compensa uma dependência inteira
 * pra isso). `FROM_ADDRESS` usa `seenlist.app`, verificado no
 * Resend (Domains → seenlist.app → Verified).
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
