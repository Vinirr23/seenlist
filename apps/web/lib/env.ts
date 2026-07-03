/**
 * Acesso centralizado a variáveis de ambiente obrigatórias. Antes
 * (TASK-002 a 007) cada arquivo de cliente Supabase fazia
 * `process.env.X!` direto — se a variável estivesse faltando, o erro
 * só aparecia bem mais tarde, de dentro do @supabase/ssr, sem dizer
 * qual variável era. Isso aqui falha cedo, com uma mensagem que diz
 * exatamente o que está faltando.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}. Confira o .env (veja .env.example).`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  tmdbApiKey: () => requireEnv("TMDB_API_KEY"),
};
