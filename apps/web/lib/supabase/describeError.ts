/**
 * Logar o objeto de erro do Supabase direto às vezes imprime "{}".
 * A primeira versão deste helper assumia que `message`/`details`/
 * `hint`/`code` sempre vinham preenchidos — mas quando a falha
 * acontece ANTES de chegar no PostgREST (erro de rede, fetch
 * rejeitado, CORS, URL errada), o objeto de erro não tem essas
 * propriedades — todas ficam `undefined`, e um objeto só com
 * propriedades `undefined` vira exatamente "{}" quando serializado
 * (é isso que apareceu de novo: a correção anterior devolvia um
 * objeto tecnicamente correto, só que vazio de verdade, porque as
 * propriedades que ele tentava ler não existiam no erro real).
 *
 * Esta versão nunca devolve um objeto vazio: sempre inclui
 * `name`/`stack` (que existem em praticamente qualquer erro do JS,
 * inclusive falha de rede) e todas as propriedades próprias que o
 * objeto realmente tiver, além de um fallback em texto puro.
 */
export function describeSupabaseError(error: unknown, extra?: Record<string, unknown>) {
  if (error === null || typeof error !== "object") {
    return { raw: String(error), ...extra };
  }

  const ownProps = Object.getOwnPropertyNames(error).reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = (error as Record<string, unknown>)[key];
    return acc;
  }, {});

  return {
    ...ownProps,
    name: (error as { name?: string }).name,
    stack: (error as { stack?: string }).stack,
    stringified: String(error),
    ...extra,
  };
}
