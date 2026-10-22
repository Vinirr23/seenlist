import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { Screen, Text, Button } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * FASE A (recuperação de senha) — rota de nível raiz, resolvida
 * automaticamente pelo Expo Router pra qualquer link
 * `seenlist://auth-callback...` (app fechado, em segundo plano ou
 * aberto — o próprio framework entrega a URL correta nos três casos,
 * o mesmo mecanismo que já faz `index.tsx` funcionar como tela
 * inicial; não precisa de `Linking.addEventListener` manual).
 *
 * CAUSA RAIZ do bug original (auditoria desta fase, ver
 * `SEENLIST-FASE-A-RECUPERACAO-SENHA-PLANO-2026-10-20.md`): esta rota
 * nunca existiu. O e-mail de recuperação já apontava pra cá
 * (`apps/mobile/app/(auth)/forgot-password.tsx`,
 * `redirectTo: Linking.createURL("auth-callback")`), mas sem o
 * arquivo de rota, o Expo Router caía na tela padrão de "Unmatched
 * Route" — o link abria, mas não tinha nada pra tratar.
 *
 * BUGFIX (2026-10-21, teste real no iPhone — tela travava pra sempre
 * em "Verificando link...") — causa raiz real, achada lendo o código
 * (não suposição): duas falhas agindo juntas.
 * 1) `Linking.useURL()` sozinho é suscetível a uma corrida conhecida
 *    com o roteamento do Expo Router em cold start — o Router já usa
 *    a URL pra decidir a rota (por isso a tela abria certo), mas o
 *    hook `useURL()` do componente pode nunca atualizar de `null` —
 *    sem fallback, o `useEffect` principal nunca rodava.
 * 2) Zero `try/catch` em volta da lógica assíncrona — qualquer exceção
 *    (rede, etc.) rejeitava a Promise sem nunca chamar
 *    `setStatus("error")`, deixando a tela presa em "loading" pra
 *    sempre, mesmo nos casos em que a URL chegava certinho.
 * Corrigido abaixo com 3 fontes de dados (useURL + getInitialURL +
 * params do próprio Router), try/catch/finally cobrindo toda a
 * lógica, e um timeout de segurança que só age se NADA tiver chegado
 * ainda (nunca interrompe uma troca de sessão já em andamento).
 *
 * BUGFIX 2 (2026-10-21, teste real — link NOVO, Supabase confirmou
 * sucesso no servidor (`Login` no log de Auth), mas o app continuou
 * mostrando "Link inválido ou expirado") — causa raiz real, achada
 * comparando o log do Supabase (sucesso) com o que a tela mostrava
 * (erro): `handledRef` controlava só "já processei ALGUMA coisa",
 * nunca "já processei ESSE link específico". Se a tela ficasse viva
 * na memória entre dois links diferentes (app nunca fechado de
 * verdade entre um teste e outro — cenário comum ao testar várias
 * vezes seguidas), o primeiro link (mesmo que tivesse falhado)
 * marcava `handledRef.current = true` pra sempre, e QUALQUER link
 * seguinte — mesmo um novo e válido — era ignorado silenciosamente
 * pelo `if (handledRef.current) return;` do topo do efeito, deixando
 * a tela presa no resultado do primeiro link enquanto o Supabase, por
 * trás, processava o segundo com sucesso. Corrigido trocando o
 * booleano por `lastProcessedKeyRef`, que guarda QUAL link (código/
 * par de tokens) já foi tratado — um link novo e diferente agora
 * sempre é reprocessado, mesmo com a tela já tendo tratado outro
 * antes; só um link IDÊNTICO ao último já tratado continua sendo
 * ignorado (mantém o requisito 3 — nunca processar o MESMO link duas
 * vezes).
 *
 * Esta mesma rota também pode, em tese, receber o retorno do login
 * Google (mesmo nome de link usado em `AuthProvider.tsx`,
 * `signInWithGoogle`) no caso raro do `WebBrowser.openAuthSessionAsync`
 * não conseguir capturar o resultado direto (ver comentário grande no
 * documento da Fase A), ou a confirmação de cadastro por e-mail
 * (`type=signup`/`email_change`/`invite`/`magiclink`, dependendo da
 * config do projeto Supabase) — por isso a decisão de pra onde navegar
 * é tomada pelo CONTEÚDO da URL (`type`), nunca por "quem eu esperava
 * que tivesse me chamado": só `type === "recovery"` vai pra tela de
 * nova senha; qualquer outro tipo com sessão estabelecida com sucesso
 * entra direto logado (não existe, nem é preciso, uma tela própria de
 * "cadastro confirmado" separada).
 *
 * SEGURANÇA — nenhum token/code é logado em nenhum momento (nem a URL
 * completa, nem os parâmetros extraídos); em caso de erro, só a
 * mensagem do próprio Supabase (ou `error.message` de uma exceção) é
 * registrada.
 */

const SAFETY_TIMEOUT_MS = 8000;

interface AuthCallbackParams {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  errorDescription: string | null;
}

/**
 * Mesmo princípio defensivo de `extractTokensFromUrl` em
 * `AuthProvider.tsx`: o Supabase pode devolver os dados tanto no
 * fragmento da URL (fluxo implícito, `#access_token=...`) quanto na
 * query (fluxo PKCE, `?code=...`) — junta os dois em vez de presumir
 * qual dos dois está ativo neste projeto (ver seção 1.5 do documento
 * da Fase A).
 */
function extractAuthCallbackParams(url: string): AuthCallbackParams {
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
    code: params.get("code"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    errorDescription: params.get("error_description"),
  };
}

function firstString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  // Fonte adicional (BUGFIX, requisito 2): o próprio Expo Router já
  // resolveu esta rota a partir da URL recebida — os parâmetros de
  // QUERY (fluxo PKCE: `?code=...&type=recovery`) ficam disponíveis
  // aqui mesmo quando, por algum motivo, `Linking.useURL()` e
  // `Linking.getInitialURL()` falharem os dois. Não cobre o fragmento
  // (`#access_token=...`, fluxo implícito) — isso só vem da URL crua.
  const searchParams = useLocalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
    type?: string;
    error_description?: string;
  }>();
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  // BUGFIX 2 — guarda QUAL link (chave derivada do código/par de
  // tokens) já foi tratado, não só "se" algo já foi tratado. Permite
  // reprocessar um link novo e diferente mesmo que a tela já tenha
  // tratado outro antes (ver comentário grande no topo do arquivo);
  // continua impedindo reprocessar o MESMO link (requisito 3).
  const lastProcessedKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // BUGFIX (requisito 6) — timeout de segurança: só entra em ação se
  // NENHUM link tiver sido processado ainda (`lastProcessedKeyRef`
  // ainda `null`). Uma vez que o processamento de um link de verdade
  // começa (`lastProcessedKeyRef.current` recebe a chave do link,
  // antes de qualquer `await`), este timeout nunca mais interfere —
  // ele não cancela nem sobrepõe uma troca de sessão já em andamento,
  // só evita ficar esperando pra sempre por uma URL que nunca chega.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!lastProcessedKeyRef.current && mountedRef.current) {
        setStatus("error");
      }
    }, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    (async () => {
      // BUGFIX (requisito 2) — três fontes, nesta ordem:
      // 1) o hook reativo `useURL()` (cobre o app já aberto recebendo
      //    um novo link);
      // 2) `Linking.getInitialURL()` chamado direto — cobre cold
      //    start sem depender do timing interno do hook acima (a
      //    causa raiz original do travamento);
      // 3) os parâmetros de query que o Expo Router já resolveu pra
      //    esta rota (fallback final, cobre o fluxo PKCE mesmo se as
      //    duas fontes de URL crua acima falharem).
      let resolvedUrl: string | null = url;
      if (!resolvedUrl) {
        try {
          resolvedUrl = await Linking.getInitialURL();
        } catch {
          resolvedUrl = null;
        }
      }

      const fromUrl = resolvedUrl ? extractAuthCallbackParams(resolvedUrl) : null;
      const fromRouter: AuthCallbackParams = {
        code: firstString(searchParams.code),
        accessToken: firstString(searchParams.access_token),
        refreshToken: firstString(searchParams.refresh_token),
        type: firstString(searchParams.type),
        errorDescription: firstString(searchParams.error_description),
      };

      const code = fromUrl?.code ?? fromRouter.code;
      const accessToken = fromUrl?.accessToken ?? fromRouter.accessToken;
      const refreshToken = fromUrl?.refreshToken ?? fromRouter.refreshToken;
      const type = fromUrl?.type ?? fromRouter.type;
      const errorDescription = fromUrl?.errorDescription ?? fromRouter.errorDescription;

      // Nada chegou ainda, nas 3 fontes — não marca nada como
      // processado (deixa este efeito rodar de novo se `url`/
      // `searchParams` mudarem depois) e deixa o timeout de segurança
      // decidir se isso virou erro, em vez de assumir que já é uma
      // falha.
      if (!code && !accessToken && !refreshToken && !errorDescription) {
        return;
      }

      // BUGFIX 2 — chave que identifica ESTE link especificamente
      // (código PKCE, ou o par de tokens do fluxo implícito, ou a
      // descrição de erro embutida pelo Supabase). Um link idêntico ao
      // último já tratado é ignorado (requisito 3); um link diferente
      // — mesmo com a tela já tendo tratado outro antes — é tratado
      // como novo, e a tela volta pro estado de carregamento enquanto
      // processa (nunca fica presa mostrando o resultado de um link
      // anterior enquanto um link novo está sendo processado).
      const linkKey = errorDescription ? `error:${errorDescription}` : code ? `code:${code}` : `tokens:${accessToken}:${refreshToken}`;
      if (linkKey === lastProcessedKeyRef.current) {
        return;
      }
      lastProcessedKeyRef.current = linkKey;
      if (mountedRef.current) setStatus("loading");

      try {
        // Link já expirado ou já usado: o Supabase embute o motivo
        // aqui (ex.: `otp_expired`) em vez de devolver tokens.
        if (errorDescription) {
          setStatus("error");
          return;
        }

        let sessionError: { message: string } | null = null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          sessionError = error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          sessionError = error;
        } else {
          // Nem `code`, nem par de tokens — link inválido/corrompido.
          // Nunca tenta estabelecer sessão com dado incompleto.
          setStatus("error");
          return;
        }

        if (sessionError) {
          console.error("[auth-callback] Falha ao estabelecer sessão:", sessionError.message);
          setStatus("error");
          return;
        }

        // BUGFIX (requisito 4) — diferencia pelo `type` que o Supabase
        // manda, nunca assume que "não é recovery" = "é OAuth".
        if (type === "recovery") {
          router.replace("/update-password");
        } else {
          // signup / email_change / invite / magiclink / sem `type`
          // (caso raro de retorno OAuth que escapou do
          // `openAuthSessionAsync`, ver comentário no topo do arquivo)
          // — em todos esses, a sessão já foi estabelecida com
          // sucesso, então o destino é o mesmo: entrar logado
          // normalmente (não existe tela própria de "cadastro
          // confirmado" neste app).
          router.replace("/(tabs)/series");
        }
      } catch (error) {
        // BUGFIX (requisito 1) — qualquer exceção não prevista (rede,
        // etc.) cai aqui; nunca deixa a tela presa em "loading".
        console.error(
          "[auth-callback] Exceção inesperada ao processar o link:",
          error instanceof Error ? error.message : String(error)
        );
        if (mountedRef.current) setStatus("error");
      }
    })();
  }, [url, searchParams.code, searchParams.access_token, searchParams.refresh_token, searchParams.type, searchParams.error_description, router]);

  if (status === "error") {
    return (
      <Screen bottomInset padded={false}>
        <View style={styles.center}>
          <Text variant="title" style={styles.title}>
            {t("auth.linkExpiredTitle")}
          </Text>
          <Text variant="muted" style={styles.subtitle}>
            {t("auth.linkExpiredMessage")}
          </Text>
          <Button onPress={() => router.replace("/(auth)/forgot-password")} style={styles.button}>
            {t("auth.requestNewLink")}
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset padded={false}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="muted" style={styles.subtitle}>
          {t("auth.verifyingLink")}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  button: {
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
});
