/**
 * Acesso centralizado a variáveis de ambiente obrigatórias. Antes
 * (TASK-002 a 007) cada arquivo de cliente Supabase fazia
 * `process.env.X!` direto — se a variável estivesse faltando, o erro
 * só aparecia bem mais tarde, de dentro do @supabase/ssr, sem dizer
 * qual variável era. Isso aqui falha cedo, com uma mensagem que diz
 * exatamente o que está faltando.
 *
 * IMPORTANTE: cada `process.env.NEXT_PUBLIC_X` abaixo precisa ficar
 * escrito por extenso, como propriedade estática — nunca
 * `process.env[nomeVariavel]`. O Next.js só consegue substituir
 * `NEXT_PUBLIC_*` pelo valor real no bundle do browser quando
 * encontra esse acesso literal em tempo de build (é uma troca de
 * texto, não uma leitura em tempo de execução). Com acesso dinâmico
 * via colchetes, o valor nunca é embutido no JS que roda no
 * navegador — no servidor funciona (lá `process.env` é o ambiente
 * real do Node), mas em qualquer código client-side (como o cliente
 * Supabase do browser, usado por `useRealtimeInvalidate`) a variável
 * chega vazia e cai direto no erro "Variável de ambiente ausente".
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}. Confira o .env (veja .env.example).`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  tmdbApiKey: () => requireEnv("TMDB_API_KEY", process.env.TMDB_API_KEY),
  /** TASK-077 — só usada no servidor (rota de API), nunca no cliente: sem prefixo NEXT_PUBLIC_ de propósito. */
  resendApiKey: () => requireEnv("RESEND_API_KEY", process.env.RESEND_API_KEY),
  /** TASK-077 — único e-mail autorizado a mandar convite em massa (`/admin/invite`). Comparado no servidor, nunca exposto ao cliente. */
  adminEmail: () => requireEnv("ADMIN_EMAIL", process.env.ADMIN_EMAIL),
  /** TASK-077 (correção) — chave de serviço do Supabase, ignora RLS. Só pra consultas administrativas no servidor (ex.: listar `beta_signups`, que não tem policy de SELECT nenhuma — nem pra usuário comum, nem pro dono, de propósito). Nunca usar no cliente. */
  supabaseServiceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
};
