import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

/**
 * TASK-052 (integração) — cliente Supabase pro mobile, com sessão
 * persistida em AsyncStorage. Não existia antes — é o mínimo de
 * infraestrutura necessário pra "sessão restaurada ao abrir o app"
 * funcionar (sem storage persistente, toda sessão se perderia ao
 * fechar o app, e "restaurar sessão" nunca aconteceria).
 *
 * Variáveis: `EXPO_PUBLIC_*` é a convenção do Expo pra env vars
 * embutidas no bundle do cliente (equivalente ao `NEXT_PUBLIC_*` que
 * o app web já usa) — precisam estar definidas em apps/mobile/.env
 * ou no app.config, com os MESMOS valores de URL/anon key do projeto
 * Supabase que o web já usa (é o mesmo projeto, não um separado).
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY ausentes — configure em apps/mobile/.env."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // não se aplica a app nativo, evita warning
  },
});

/**
 * TASK-135 (correção — "sessão sumindo" ao abrir o app) — substituto
 * de `supabase.auth.getUser()`, com o MESMO formato de retorno
 * (`{ data: { user }, error }`) — troca direta em qualquer lugar que
 * já chamava `supabase.auth.getUser()`, sem precisar mudar mais nada
 * ao redor da chamada.
 *
 * Causa raiz confirmada por log real (não suposição): `getUser()`
 * valida a sessão contra o servidor e pode falhar com
 * "AuthSessionMissingError" se rodar antes do cliente Supabase
 * terminar de carregar a sessão salva na memória — mesmo a sessão
 * existindo de verdade (visto no log: `getSession()` achava a
 * sessão, `getUser()` não achava a MESMA sessão, milissegundos
 * depois). `getSession()` lê do armazenamento local, sem essa
 * corrida — por isso esta função usa `getSession()` por baixo.
 */
export async function getCurrentAuthUser() {
  const { data, error } = await supabase.auth.getSession();
  return { data: { user: data.session?.user ?? null }, error };
}
