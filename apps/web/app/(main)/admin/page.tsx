import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

/**
 * Hub de admin — a pedido, pra não precisar mais decorar/lembrar os
 * links de cada ferramenta separada. Mesma checagem "de verdade" das
 * outras páginas de `/admin/*`: Server Component, roda no servidor,
 * nunca expõe `env.adminEmail()` ao navegador. Cada ferramenta listada
 * aqui já faz a MESMA checagem de novo na própria página — este hub é
 * só um índice, não abre nenhum atalho de segurança.
 *
 * De propósito, lista só as ferramentas dentro de `/admin/*`. As
 * páginas em `/debug/*` e `/diagnostics/*` são diagnósticos internos
 * temporários (ex.: `/debug/database` nem tem checagem de admin — é
 * pra ser removida depois) e não fazem parte deste índice.
 */
export const dynamic = "force-dynamic";

const ADMIN_TOOLS = [
  {
    href: "/admin/observability",
    title: "Observabilidade",
    description: "Métricas de uso, crescimento e engajamento dos usuários.",
  },
  {
    href: "/admin/moderation",
    title: "Moderação",
    description: "Denúncias de posts reportados, para revisar e agir.",
  },
  {
    href: "/admin/invite",
    title: "Convites",
    description: "Enviar convites de beta para novos usuários.",
  },
  {
    href: "/admin/repair-series",
    title: "Reparar séries",
    description: "Corrigir dados de categoria de séries com problema.",
  },
] as const;

export default async function AdminHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== env.adminEmail()) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center px-4 text-center md:mx-auto md:max-w-[430px]">
        <p className="text-sm text-muted">Você não tem acesso a esta página.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 px-4 pb-24 pt-4 md:mx-auto md:max-w-[900px]">
      <div>
        <h1 className="text-xl font-bold text-text">Admin</h1>
        <p className="mt-1 text-xs text-muted">
          Todas as ferramentas de administração do SeenList, em um só lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ADMIN_TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
          >
            <h2 className="text-sm font-semibold text-text">{tool.title}</h2>
            <p className="mt-1 text-xs text-muted">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
