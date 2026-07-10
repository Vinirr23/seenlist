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
