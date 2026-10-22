import "react-native-url-polyfill/auto";
import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
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

/**
 * FASE B (auditoria de 2026-10-20) — REVERTIDO. Tentei aplicar
 * `createClient<Database>(...)` (ver `packages/types/src/database.ts`,
 * gerado pelo Supabase CLI 2.110.0 contra o schema real), mas isso
 * piorou o resultado do `tsc` (540 erros, era 290) — causa raiz:
 * incompatibilidade de versão entre o `Database` gerado por essa
 * versão da CLI (que já inclui campos como `SetofOptions` em
 * `Functions`) e o parser de tipos do `@supabase/postgrest-js@1.16.1`
 * (empacotado dentro de `@supabase/supabase-js@2.45.4`, a versão
 * instalada) — esse parser mais antigo não reconhece o formato novo e
 * devolve `SelectQueryError<"Invalid RelationName cannot infer result
 * type">` pra praticamente todo `.select(...)`, mesmo com string
 * literal simples (confirmado em `lib/currentUser.ts`, sem nenhum
 * join/alias). Revertido pra manter o comportamento conhecido (os 290
 * erros pré-existentes, documentados na auditoria) até decidir, com o
 * usuário, se vale atualizar `@supabase/supabase-js` ou gerar os tipos
 * contra uma versão mais antiga da CLI compatível com a lib instalada.
 */
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

/**
 * CORREÇÃO (2026-10-20, achado na validação da Fase 1 — migração
 * mobile sem Vercel) — `autoRefreshToken: true` (acima) mantém um
 * timer interno renovando o access token antes de expirar, mas esse
 * timer é um `setTimeout`/`setInterval` comum do JS, que o React
 * Native PAUSA quando o app vai pra segundo plano (limitação de
 * qualquer app RN, não um bug deste projeto). A documentação oficial
 * do `supabase-js` para React Native recomenda explicitamente ligar
 * esse timer ao ciclo de vida do app via `AppState`
 * (https://supabase.com/docs/reference/javascript/auth-startautorefresh) —
 * sem isso, reabrir o app depois de muito tempo em segundo plano pode
 * disparar a primeira chamada (inclusive às 4 Edge Functions novas da
 * Fase 1, que exigem JWT válido antes mesmo de rodar) com o token já
 * expirado, recebendo 401 até o timer conseguir renovar.
 *
 * `startAutoRefresh()`/`stopAutoRefresh()` SÓ controlam esse timer —
 * não disparam login/logout nem mudam a sessão guardada no
 * AsyncStorage, então o fluxo de login/logout/recuperação de sessão
 * (`AuthProvider.tsx`, `getCurrentAuthUser` acima) continua
 * exatamente como está, sem nenhuma mudança de comportamento.
 *
 * Registrado como HOOK (não como efeito solto no escopo do módulo,
 * que rodaria de novo a cada Fast Refresh em dev e arriscaria
 * registrar o listener mais de uma vez) — mesmo padrão já usado por
 * `useInAppUpdateCheck`/`useOtaUpdateCheck`/`useNotificationDeepLinks`
 * (`app/_layout.tsx`): chamado uma única vez no componente raiz, com
 * `useEffect`/`[]` garantindo um único registro durante a vida do
 * app e `subscription.remove()` no cleanup garantindo que nenhum
 * listener fique duplicado (ex.: em testes, ou se o componente raiz
 * algum dia desmontar/remontar).
 */
export function useSupabaseAutoRefresh(): void {
  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus) {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    }

    // `AppState.currentState` já reflete o estado atual de forma
    // síncrona (sem esperar o primeiro evento de mudança) — sem isso,
    // um app aberto direto em "active" ficaria sem o timer rodando
    // até a PRÓXIMA transição de estado.
    handleAppStateChange(AppState.currentState);

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
