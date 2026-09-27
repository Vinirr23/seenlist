import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications, removePushToken } from "@/lib/pushNotifications";
import { markSessionReady } from "@/lib/appReady";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export type AuthResult = { error: string | null; message?: string };

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, confirmPassword: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  /**
   * REQUISITO DA APP STORE (2026-09-22, rejeição real — App Review,
   * Guideline 4.8 "Login Services") — a Apple exige que todo app que
   * ofereça login de terceiro (aqui, Google) ofereça também "Sign in
   * with Apple" como alternativa equivalente, com as mesmas garantias
   * de privacidade (nome/e-mail só, e-mail oculto opcional, sem coleta
   * de interação sem consentimento). `null` em telas que só existem no
   * Android (nenhuma agora, mas mantém o tipo explícito) — quem chama
   * decide se mostra o botão via `AppleAuthentication.isAvailableAsync()`/
   * `Platform.OS === "ios"`, não este método.
   */
  signInWithApple: () => Promise<AuthResult>;
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
  /**
   * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem alguma
   * pendência de design", 2026-09-16) — todas as mensagens de
   * erro/sucesso deste arquivo eram texto fixo em português, mesmo
   * pra quem está usando o app em inglês/espanhol. Único arquivo
   * "central" ainda faltando tradução (as telas de login/cadastro/
   * esqueci-a-senha também estavam sem NENHUM `t()`, corrigidas
   * juntas nesta mesma leva — ver `app/(auth)/{login,register,
   * forgot-password}.tsx`). Chaves novas em `translations.ts`
   * (`auth.fillEmailAndPassword`, `auth.invalidCredentials`, etc.) —
   * as chaves de placeholder/rótulo já existiam, só as mensagens de
   * validação/erro é que nunca tinham sido criadas.
   */
  const { t } = useTranslation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // A splash nativa só esconde de vez quando ISTO e o carregamento
      // da fonte (`app/_layout.tsx`, `useFonts`) tiverem os dois
      // terminado — ver `lib/appReady.ts` pro raciocínio completo
      // (antes era só a sessão; ganhou a fonte como segunda condição
      // a pedido, pra não "piscar" trocando de fonte na frente do
      // usuário). Continua sem piso de tempo fixo nenhum.
      markSessionReady();
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
  }, [session?.user.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,

      async signInWithEmail(email, password) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
          return { error: t("auth.fillEmailAndPassword") };
        }
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) return { error: t("auth.invalidCredentials") };
        return { error: null };
      },

      async signUpWithEmail(email, password, confirmPassword) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
          return { error: t("auth.fillEmailAndPassword") };
        }
        if (password.length < 8) {
          return { error: t("auth.passwordTooShort") };
        }
        if (password !== confirmPassword) {
          return { error: t("auth.passwordsDontMatch") };
        }

        const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
        if (error) {
          return {
            error: error.message === "User already registered" ? t("auth.emailAlreadyRegistered") : t("auth.signUpError"),
          };
        }

        // Se a confirmação de e-mail estiver habilitada no projeto Supabase,
        // `session` vem nulo aqui — mesma regra do web (lib/actions/auth.ts).
        if (!data.session) {
          return { error: null, message: t("auth.signUpConfirmEmail") };
        }
        return { error: null };
      },

      async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: GOOGLE_REDIRECT_URL, skipBrowserRedirect: true },
        });

        if (error || !data?.url) {
          return { error: t("auth.googleSignInError") };
        }

        const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URL);

        if (result.type === "cancel" || result.type === "dismiss") {
          return { error: null }; // usuário desistiu — não é um erro pra mostrar
        }
        if (result.type !== "success" || !result.url) {
          return { error: t("auth.googleSignInError") };
        }

        const { accessToken, refreshToken, errorDescription } = extractTokensFromUrl(result.url);
        if (errorDescription) return { error: errorDescription };
        if (!accessToken || !refreshToken) {
          return { error: t("auth.googleSignInIncomplete") };
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          return { error: t("auth.googleSignInIncomplete") };
        }

        return { error: null };
      },

      /**
       * REQUISITO DA APP STORE (2026-09-22, ver comentário grande no
       * tipo `AuthContextValue.signInWithApple`, acima) — fluxo NATIVO
       * (`expo-apple-authentication`, painel de sistema da Apple, sem
       * navegador), diferente do Google acima (que abre uma aba externa
       * e volta via deep link): a própria Apple entrega um
       * `identityToken` (JWT assinado pela Apple) que o Supabase aceita
       * direto via `signInWithIdToken` — sem passar pelo
       * `WebBrowser.openAuthSessionAsync`/bridge de URL que o Google
       * precisa. Exemplo oficial do Supabase pra Expo/React Native não
       * usa `nonce` neste método (diferente do fluxo web/OAuth) — https://supabase.com/docs/guides/auth/social-login/auth-apple.
       *
       * VINCULAÇÃO DE CONTA (dúvida real, levantada ao pedir ajuda com
       * a rejeição) — o Supabase já vincula automaticamente uma nova
       * identidade (Apple) a uma conta existente com o MESMO e-mail
       * verificado (Google, e-mail/senha) por padrão — não precisa de
       * coluna própria tipo `apple_account_id`/`google_account_id` pra
       * evitar conta duplicada. Isso vale inclusive pro e-mail de relay
       * da Apple (`@privaterelay.appleid.com`): a Apple devolve o MESMO
       * endereço de relay pra esse app em todo login futuro com o mesmo
       * Apple ID, então a vinculação por e-mail continua funcionando
       * normalmente. Ver `auth-identity-linking` na doc do Supabase.
       */
      async signInWithApple() {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          });

          if (!credential.identityToken) {
            return { error: t("auth.appleSignInError") };
          }

          const { error } = await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: credential.identityToken,
          });
          if (error) return { error: t("auth.appleSignInError") };
          return { error: null };
        } catch (error) {
          // Usuário cancelou o painel nativo — não é um erro pra mostrar (mesma regra do Google acima, `result.type === "cancel"`).
          if (error && typeof error === "object" && "code" in error && error.code === "ERR_REQUEST_CANCELED") {
            return { error: null };
          }
          console.error("[AuthProvider] Falha ao entrar com a Apple", error);
          return { error: t("auth.appleSignInError") };
        }
      },

      async signOut() {
        await removePushToken(supabase);
        await supabase.auth.signOut();
      },
    }),
    [session, loading, t]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa ser usado dentro de <AuthProvider>.");
  return ctx;
}
