import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, removePushToken } from "@/lib/pushNotifications";

export type AuthResult = { error: string | null; message?: string };

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, confirmPassword: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * TASK-090 (app nativo) — pro OAuth conseguir voltar pro app depois
 * do login no navegador externo, precisa de uma URL de retorno que o
 * sistema operacional saiba entregar pro SeenList. `Linking.createURL`
 * monta isso automaticamente pro ambiente certo: `seenlist://auth-
 * callback` num build de verdade, ou um endereço `exp://...` durante
 * desenvolvimento com Expo Go/dev client — sem isso precisar ser
 * escrito à mão dos dois jeitos.
 *
 * IMPORTANTE (configuração manual, fora do código): essa URL precisa
 * estar na lista de "Redirect URLs" permitidas do projeto Supabase
 * (Authentication → URL Configuration), senão o Supabase recusa
 * redirecionar de volta pro app depois do login do Google.
 */
const GOOGLE_REDIRECT_URL = Linking.createURL("auth-callback");

/**
 * O Supabase pode devolver os tokens de sessão tanto no fragmento da
 * URL (`#access_token=...`, padrão do fluxo implícito) quanto na
 * query (`?access_token=...`) — junta os dois em vez de assumir um
 * formato só, pra não quebrar se um dia isso mudar de um lado.
 */
function extractTokensFromUrl(url: string): {
  accessToken: string | null;
  refreshToken: string | null;
  errorDescription: string | null;
} {
  const params = new URLSearchParams();
  const [, afterQuery] = url.split("?");
  if (afterQuery) {
    new URLSearchParams(afterQuery.split("#")[0]).forEach((value, key) => params.set(key, value));
  }
  const [, afterHash] = url.split("#");
  if (afterHash) {
    new URLSearchParams(afterHash).forEach((value, key) => params.set(key, value));
  }

  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    errorDescription: params.get("error_description"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[Auth] Restaurando sessão ao abrir o app:", {
        sessaoEncontrada: !!data.session,
        provedor: data.session?.user.app_metadata?.provider ?? "nenhum",
        erro: error?.message ?? null,
      });
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  /**
   * TASK-114 (Notificações) — "chamar isto assim que existir uma
   * tela pós-login" (comentário original em pushNotifications.ts,
   * de uma sessão anterior a esta) — é exatamente isso que já
   * temos agora. Depende de `session?.user.id`, não de `session`
   * inteiro: o objeto de sessão muda a cada renovação de token,
   * mas o registro de push só precisa acontecer de novo quando o
   * USUÁRIO muda (login/logout), não a cada refresh silencioso.
   */
  useEffect(() => {
    if (!session?.user.id) return;
    registerForPushNotifications(supabase).catch((error) => {
      console.warn("[AuthProvider] Falha ao registrar push notifications", error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,

      async signInWithEmail(email, password) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
          return { error: "Preencha e-mail e senha." };
        }
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) return { error: "E-mail ou senha inválidos." };
        return { error: null };
      },

      async signUpWithEmail(email, password, confirmPassword) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
          return { error: "Preencha e-mail e senha." };
        }
        if (password.length < 8) {
          return { error: "A senha precisa ter pelo menos 8 caracteres." };
        }
        if (password !== confirmPassword) {
          return { error: "As senhas não coincidem." };
        }

        const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
        if (error) {
          return {
            error:
              error.message === "User already registered" ? "Este e-mail já tem cadastro." : "Não foi possível criar a conta.",
          };
        }

        // Se a confirmação de e-mail estiver habilitada no projeto Supabase,
        // `session` vem nulo aqui — mesma regra do web (lib/actions/auth.ts).
        if (!data.session) {
          return { error: null, message: "Cadastro criado. Confirme seu e-mail para poder entrar." };
        }
        return { error: null };
      },

      async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: GOOGLE_REDIRECT_URL, skipBrowserRedirect: true },
        });

        if (error || !data?.url) {
          return { error: "Não foi possível entrar com o Google agora. Tente de novo em instantes." };
        }

        const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URL);

        if (result.type === "cancel" || result.type === "dismiss") {
          return { error: null }; // usuário desistiu — não é um erro pra mostrar
        }
        if (result.type !== "success" || !result.url) {
          return { error: "Não foi possível entrar com o Google agora. Tente de novo em instantes." };
        }

        const { accessToken, refreshToken, errorDescription } = extractTokensFromUrl(result.url);
        if (errorDescription) return { error: errorDescription };
        if (!accessToken || !refreshToken) {
          console.warn("[Auth] Google: token ausente na URL de retorno", {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });
          return { error: "Não foi possível concluir o login com o Google." };
        }

        /**
         * TASK-130 (investigação — sessão do Google não persiste) —
         * login por e-mail/senha continua logado ao reabrir o app;
         * login pelo Google não. Como os dois usam o MESMO cliente
         * Supabase (mesmo `persistSession`/AsyncStorage), a suspeita
         * é que `setSession()` (só usado pelo fluxo do Google) não
         * está terminando de gravar no armazenamento antes do app
         * seguir em frente — ou o refresh_token que volta na URL do
         * Google já vem inválido por algum motivo. Este log confirma
         * de verdade se a sessão foi pro AsyncStorage (não só pra
         * memória) — próxima vez que reproduzir o bug, manda o que
         * aparecer aqui no console.
         */
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          console.warn("[Auth] Google: setSession falhou", sessionError.message);
          return { error: "Não foi possível concluir o login com o Google." };
        }

        const readBack = await supabase.auth.getSession();
        console.log("[Auth] Google: sessão salva?", {
          setSessionRetornouUsuario: !!sessionData.session?.user,
          getSessionConfirmaSessao: !!readBack.data.session,
          refreshTokenPresente: !!readBack.data.session?.refresh_token,
        });

        return { error: null };
      },

      async signOut() {
        await removePushToken(supabase);
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa ser usado dentro de <AuthProvider>.");
  return ctx;
}
