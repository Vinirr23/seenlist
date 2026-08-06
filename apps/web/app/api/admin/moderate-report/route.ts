import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * A PEDIDO — ações de moderação de denúncia. Mesma checagem dupla
 * das outras rotas administrativas (sessão logada E e-mail batendo
 * com `ADMIN_EMAIL`), porque a chave de serviço usada aqui ignora
 * RLS: sem isso, qualquer pessoa que descobrisse a URL poderia
 * apagar post dos outros.
 *
 * Duas ações:
 * - `remove`: soft-delete do post (`deleted_at`), mesmo padrão que o
 *   próprio autor usa ao apagar — a linha continua no banco, o post
 *   some das telas. A denúncia é apagada junto (já foi resolvida).
 * - `dismiss`: só apaga a denúncia, mantendo o post. Pra caso de
 *   denúncia indevida.
 */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user && user.email === env.adminEmail());
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  let body: { reportId?: string; postId?: string; action?: "remove" | "dismiss" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const { reportId, postId, action } = body;
  if (!reportId || (action !== "remove" && action !== "dismiss")) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (action === "remove") {
    if (!postId) {
      return NextResponse.json({ error: "postId é obrigatório para remover." }, { status: 400 });
    }
    const { error: deleteError } = await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", postId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  const { error: reportError } = await supabase.from("post_reports").delete().eq("id", reportId);
  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
