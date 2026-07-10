/**
 * scripts/check-library.ts — TASK-020
 *
 * Diagnóstico do backend, fora do React inteiramente. Roda direto no
 * Node contra o Supabase de verdade, imprime tudo, não esconde erro
 * nenhum.
 *
 * DUAS FORMAS DE ACESSO, PORQUE SÃO DUAS COISAS DIFERENTES:
 *
 * 1. `@supabase/supabase-js` (API REST/PostgREST) — usada nas Partes
 *    1, 3 e 4. Reproduz EXATAMENTE o que o app faz (mesmo cliente,
 *    mesmas regras de RLS). Só precisa da URL + anon key do projeto
 *    (as mesmas do `.env.local` do app) e de um usuário de teste
 *    (e-mail/senha) pra logar de verdade — RLS não deixa nada passar
 *    sem `auth.uid()` preenchido, então testar sem sessão autenticada
 *    não prova nada.
 *
 * 2. `pg` (conexão direta em Postgres) — usada nas Partes 2 e 5.
 *    `information_schema` e `pg_policies` NÃO são expostos pela API
 *    REST do Supabase (só tabelas do schema `public` com GRANT
 *    aparecem ali) — pra ver colunas/tipos/PK/FK e as policies de
 *    RLS de verdade, é preciso a connection string direta do
 *    Postgres (Supabase → Project Settings → Database → Connection
 *    string → "URI"). Essa parte é OPCIONAL: se `SUPABASE_DB_URL`
 *    não estiver configurada, o script avisa e pula, sem quebrar o
 *    resto.
 *
 * COMO RODAR
 *   cd scripts && npm install
 *   cp .env.example .env   # preencha as variáveis
 *   npx tsx check-library.ts
 *
 * Nenhuma dessas variáveis tem valor real aqui — preencha no seu
 * `.env` local, nunca commite isso.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import "dotenv/config";

// ---------------------------------------------------------------
// Config — lidas do .env deste diretório (scripts/.env)
// ---------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;
const DB_URL = process.env.SUPABASE_DB_URL; // opcional — Parte 2 e 5 precisam disso

function section(title: string) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

/** Não esconder erro nenhum — sempre as três formas, igual TASK-018/019. */
function dumpError(label: string, error: unknown) {
  console.log(`\n--- ERRO: ${label} ---`);
  console.log("console.log(error):", error);
  try {
    console.log("JSON.stringify(error):", JSON.stringify(error, null, 2));
  } catch {
    console.log("JSON.stringify(error): (não serializável)");
  }
  console.dir(error, { depth: null });
  console.log("--- fim do erro ---\n");
}

async function requireEnv() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!TEST_EMAIL) missing.push("SUPABASE_TEST_EMAIL");
  if (!TEST_PASSWORD) missing.push("SUPABASE_TEST_PASSWORD");

  if (missing.length > 0) {
    console.error(
      `\nFaltando no scripts/.env: ${missing.join(", ")}.\n` +
        "Preencha antes de rodar — sem isso não dá pra logar como um usuário de teste " +
        "de verdade, e sem sessão autenticada o RLS bloqueia tudo (o que por si só não " +
        "prova bug nenhum, só que ninguém logou).\n"
    );
    process.exit(1);
  }
}

async function getAuthenticatedClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

  console.log(`Autenticando como ${TEST_EMAIL}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL!,
    password: TEST_PASSWORD!,
  });

  if (error || !data.user) {
    dumpError("login do usuário de teste", error);
    console.error(
      "\nNão deu pra autenticar o usuário de teste. Sem isso, nenhuma das Partes 1/3/4 " +
        "consegue testar RLS de verdade (tudo apareceria vazio ou bloqueado, o que pareceria " +
        "um bug de RLS mas seria só falta de sessão). Confira SUPABASE_TEST_EMAIL/PASSWORD.\n"
    );
    process.exit(1);
  }

  console.log(`Autenticado. user.id = ${data.user.id}`);
  return { supabase, userId: data.user.id };
}

// ---------------------------------------------------------------
// Parte 1 — conectar, buscar usuário, consultas básicas
// ---------------------------------------------------------------
async function parte1(supabase: SupabaseClient) {
  section("PARTE 1 — Conexão + consultas básicas");

  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log("auth.getUser() ->", { user: userData.user, error: userError });
  if (userError) dumpError("auth.getUser()", userError);

  for (const table of ["movie_status", "series_status", "profiles"] as const) {
    console.log(`\n> select * from ${table} limit 1;`);
    const { data, error, status, statusText } = await supabase.from(table).select("*").limit(1);
    console.log(`  status HTTP: ${status} ${statusText}`);
    console.log("  data:", data);
    if (error) dumpError(`select * from ${table} limit 1`, error);
  }

  console.log(
    "\n> Tabelas públicas via information_schema (só funciona se SUPABASE_DB_URL estiver configurada — ver Parte 2)."
  );
}

// ---------------------------------------------------------------
// Parte 2 — schema completo (precisa de conexão direta em Postgres)
// ---------------------------------------------------------------
async function parte2() {
  section("PARTE 2 — Schema completo (movie_status, series_status, profiles)");

  if (!DB_URL) {
    console.log(
      "SUPABASE_DB_URL não configurada — pulando. Pra rodar esta parte, pegue a " +
        "connection string em Supabase → Project Settings → Database → Connection string → URI, " +
        "e coloque em scripts/.env como SUPABASE_DB_URL."
    );
    return;
  }

  const client = new PgClient({ connectionString: DB_URL });
  try {
    await client.connect();

    console.log("\n> Todas as tabelas do schema public:");
    const tables = await client.query(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name;`
    );
    console.table(tables.rows);

    for (const table of ["movie_status", "series_status", "profiles"]) {
      console.log(`\n--- ${table} ---`);

      const columns = await client.query(
        `select column_name, data_type, is_nullable, column_default
         from information_schema.columns
         where table_schema = 'public' and table_name = $1
         order by ordinal_position;`,
        [table]
      );
      console.log("Colunas:");
      console.table(columns.rows);

      const pk = await client.query(
        `select kcu.column_name
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
         where tc.table_schema = 'public' and tc.table_name = $1 and tc.constraint_type = 'PRIMARY KEY';`,
        [table]
      );
      console.log(
        "Primary key:",
        pk.rows.length > 0 ? pk.rows.map((r) => r.column_name).join(", ") : "(nenhuma tabela encontrada ou sem PK)"
      );

      const fks = await client.query(
        `select
           kcu.column_name as coluna,
           ccu.table_name as tabela_referenciada,
           ccu.column_name as coluna_referenciada
         from information_schema.table_constraints tc
         join information_schema.key_column_usage kcu
           on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
         join information_schema.constraint_column_usage ccu
           on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
         where tc.table_schema = 'public' and tc.table_name = $1 and tc.constraint_type = 'FOREIGN KEY';`,
        [table]
      );
      console.log("Foreign keys:", fks.rows.length > 0 ? fks.rows : "(nenhuma)");
    }
  } catch (error) {
    dumpError("conexão/consulta direta em Postgres (Parte 2)", error);
  } finally {
    await client.end().catch(() => {});
  }
}

// ---------------------------------------------------------------
// Parte 3 — confirmar que o frontend assume os nomes certos
// ---------------------------------------------------------------
function parte3() {
  section("PARTE 3 — Nomes de tabela assumidos pelo frontend");
  console.log(
    "Conferido por leitura de código (não depende de rede): o frontend só referencia\n" +
      "'movie_status' e 'series_status' em todo o projeto — nenhum arquivo usa 'user_series'\n" +
      "ou qualquer outro nome. Arquivos que fazem essas chamadas:\n" +
      "  apps/web/lib/queries/movie-status-state.ts\n" +
      "  apps/web/lib/queries/movie-status-mutations.ts\n" +
      "  apps/web/lib/queries/series-status-state.ts\n" +
      "  apps/web/lib/queries/series-status-mutations.ts\n" +
      "  apps/web/lib/queries/library-state.ts\n" +
      "  apps/web/lib/queries/library-mutations.ts\n" +
      "Se a Parte 1 ou 2 mostrar tabelas com nome diferente desses no seu projeto real,\n" +
      "É AQUI que o frontend precisa ser corrigido — não o contrário."
  );
}

// ---------------------------------------------------------------
// Parte 4 — INSERT manual → SELECT → DELETE
// ---------------------------------------------------------------
async function parte4(supabase: SupabaseClient, userId: string) {
  section("PARTE 4 — INSERT manual de teste → SELECT → DELETE");

  // TMDB id bem alto e improvável de colidir com dado real do usuário de teste.
  const TEST_SERIES_ID = 999999001;

  console.log(
    `\n> insert into series_status (user_id, series_id, status) values ('${userId}', ${TEST_SERIES_ID}, 'want_to_watch');`
  );
  const insertResult = await supabase
    .from("series_status")
    .insert({ user_id: userId, series_id: TEST_SERIES_ID, status: "want_to_watch" })
    .select();

  console.log("Resultado do insert:", insertResult);
  if (insertResult.error) {
    dumpError("INSERT de teste em series_status", insertResult.error);
    console.log("\nInsert falhou — pulando select/delete de teste (não tem o que verificar).");
    return;
  }

  console.log(`\n> select * from series_status where series_id = ${TEST_SERIES_ID};`);
  const selectResult = await supabase.from("series_status").select("*").eq("series_id", TEST_SERIES_ID);
  console.log("Resultado do select:", selectResult);
  if (selectResult.error) dumpError("SELECT de teste em series_status", selectResult.error);

  console.log(`\n> delete from series_status where series_id = ${TEST_SERIES_ID};`);
  const deleteResult = await supabase.from("series_status").delete().eq("series_id", TEST_SERIES_ID);
  console.log("Resultado do delete:", deleteResult);
  if (deleteResult.error) dumpError("DELETE de teste em series_status", deleteResult.error);
}

// ---------------------------------------------------------------
// Parte 5 — policies de RLS (precisa de conexão direta em Postgres)
// ---------------------------------------------------------------
async function parte5() {
  section("PARTE 5 — Policies de RLS (movie_status, series_status)");

  if (!DB_URL) {
    console.log("SUPABASE_DB_URL não configurada — pulando (mesma explicação da Parte 2).");
    return;
  }

  const client = new PgClient({ connectionString: DB_URL });
  try {
    await client.connect();

    const policies = await client.query(
      `select tablename, policyname, cmd, roles, qual, with_check
       from pg_policies
       where schemaname = 'public' and tablename in ('movie_status', 'series_status')
       order by tablename, cmd;`
    );
    console.log("\nPolicies encontradas:");
    console.table(policies.rows);

    const rls = await client.query(
      `select relname as tabela, relrowsecurity as rls_habilitado
       from pg_class
       where relname in ('movie_status', 'series_status') and relnamespace = 'public'::regnamespace;`
    );
    console.log("\nRLS habilitado?");
    console.table(rls.rows);

    console.log(
      "\nEsperado (conforme as migrations deste projeto): 4 policies por tabela\n" +
        "(select/insert/update/delete), todas com `qual`/`with_check` = `(auth.uid() = user_id)`,\n" +
        "e `rls_habilitado = true` nas duas. Se algo aqui vier vazio ou diferente, é a causa."
    );
  } catch (error) {
    dumpError("conexão/consulta direta em Postgres (Parte 5)", error);
  } finally {
    await client.end().catch(() => {});
  }
}

// ---------------------------------------------------------------
async function main() {
  await requireEnv();
  const { supabase, userId } = await getAuthenticatedClient();

  await parte1(supabase);
  await parte2();
  parte3();
  await parte4(supabase, userId);
  await parte5();

  section("FIM — Parte 6 (voltar ao frontend) só depois de revisar tudo acima");
  console.log(
    "Não mexi em nenhum código do app neste script — é só diagnóstico. Se tudo\n" +
      "acima veio limpo (sem erro em nenhuma parte), o problema não está no banco, e\n" +
      "faz sentido voltar pro frontend. Se apareceu erro em qualquer parte, essa é a\n" +
      "causa — corrija ali antes de mexer em mais nada no React."
  );
}

main().catch((error) => {
  dumpError("erro não tratado em main()", error);
  process.exit(1);
});
