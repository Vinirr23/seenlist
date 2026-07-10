import { createClient } from "@/lib/supabase/server";

/**
 * TASK-021 — página de diagnóstico temporária. Sem hook, sem React
 * Query, sem cache, sem componente de UI do design system — só
 * `createClient()` + `await supabase.from(...).select(...)` direto,
 * exatamente como pedido. Roda inteira no servidor (Server
 * Component), então nem precisa de useState/useEffect.
 *
 * Fica fora do grupo (main) de propósito — não é uma tela do
 * produto, é ferramenta de diagnóstico. Remover depois de resolver
 * o problema real (tabelas ausentes no banco).
 */

interface QueryOutcome {
  label: string;
  ok: boolean;
  data: unknown;
  error: unknown;
  status?: number;
  statusText?: string;
  count?: number | null;
}

async function run(
  label: string,
  fn: () => PromiseLike<{
    data: unknown;
    error: unknown;
    status: number;
    statusText: string;
    count: number | null;
  }>
): Promise<QueryOutcome> {
  console.log(`[debug/database] iniciando: ${label}`);

  try {
    const result = await fn();

    console.log(`[debug/database] resultado: ${label}`, result);
    console.dir(result, { depth: null });

    return {
      label,
      ok: !result.error,
      data: result.data,
      error: result.error,
      status: result.status,
      statusText: result.statusText,
      count: result.count,
    };
  } catch (error) {
    console.error(`[debug/database] exceção não tratada: ${label}`, error);
    console.dir(error, { depth: null });

    return {
      label,
      ok: false,
      data: null,
      error,
    };
  }
}

export default async function DebugDatabasePage() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  console.log("[debug/database] auth.getUser()", {
    user: userData.user,
    error: userError,
  });

  const outcomes: QueryOutcome[] = [];

  outcomes.push(
    await run("SELECT profiles", async () => {
      return await supabase.from("profiles").select("*").limit(5);
    })
  );

  outcomes.push(
    await run("SELECT movie_status", async () => {
      return await supabase.from("movie_status").select("*").limit(5);
    })
  );

  outcomes.push(
    await run("SELECT series_status", async () => {
      return await supabase.from("series_status").select("*").limit(5);
    })
  );

  outcomes.push(
    await run("SELECT watched_episodes", async () => {
      return await supabase.from("watched_episodes").select("*").limit(5);
    })
  );

  let insertOutcome: QueryOutcome | null = null;
  let deleteOutcome: QueryOutcome | null = null;

  if (userData.user) {
    const TEST_MOVIE_ID = 999999001;

    insertOutcome = await run("INSERT teste em movie_status", async () => {
      return await supabase
        .from("movie_status")
        .insert({
          user_id: userData.user.id,
          movie_id: TEST_MOVIE_ID,
          status: "want_to_watch",
        })
        .select();
    });

    deleteOutcome = await run("DELETE teste em movie_status", async () => {
      return await supabase
        .from("movie_status")
        .delete()
        .eq("movie_id", TEST_MOVIE_ID)
        .select();
    });
  }

  const lines: string[] = [];

  lines.push("SeenList — /debug/database");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("USUÁRIO AUTENTICADO");
  lines.push(`  id: ${userData.user?.id ?? "(nenhum — não autenticado)"}`);
  lines.push(`  email: ${userData.user?.email ?? "-"}`);

  if (userError) {
    lines.push(`  erro: ${JSON.stringify(userError)}`);
  }

  lines.push("");

  for (const outcome of outcomes) {
    lines.push("-".repeat(60));
    lines.push(`${outcome.label} — ${outcome.ok ? "OK" : "ERRO"}`);
    lines.push(`  status: ${outcome.status ?? "-"} ${outcome.statusText ?? ""}`);
    lines.push(`  count: ${outcome.count ?? "-"}`);
    lines.push(`  data: ${JSON.stringify(outcome.data)}`);

    if (!outcome.ok) {
      lines.push(`  error: ${JSON.stringify(outcome.error, null, 2)}`);
    }
  }

  lines.push("-".repeat(60));

  if (!userData.user) {
    lines.push(
      "INSERT/DELETE teste — PULADO (sem usuário autenticado, faça login primeiro)"
    );
  } else {
    lines.push(
      `INSERT teste (movie_status) — ${insertOutcome?.ok ? "OK" : "ERRO"}`
    );
    lines.push(`  data: ${JSON.stringify(insertOutcome?.data)}`);

    if (!insertOutcome?.ok) {
      lines.push(
        `  error: ${JSON.stringify(insertOutcome?.error, null, 2)}`
      );
    }

    lines.push("");

    lines.push(
      `DELETE teste (movie_status) — ${deleteOutcome?.ok ? "OK" : "ERRO"}`
    );
    lines.push(`  data: ${JSON.stringify(deleteOutcome?.data)}`);

    if (!deleteOutcome?.ok) {
      lines.push(
        `  error: ${JSON.stringify(deleteOutcome?.error, null, 2)}`
      );
    }
  }

  lines.push("=".repeat(60));
  lines.push(
    "Log completo (data/error/status/statusText/count) também impresso no terminal do `next dev`."
  );

  return (
    <pre
      style={{
        margin: 0,
        padding: 24,
        minHeight: "100dvh",
        background: "#000",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 13,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {lines.join("\n")}
    </pre>
  );
}