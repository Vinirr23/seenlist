type Listener = (error: Error, isFatal: boolean) => void;

let listeners: Listener[] = [];
let installed = false;

/**
 * CAUSAS JÁ DIAGNOSTICADAS (2026-10-09) — erros fatais que já sabemos
 * a causa raiz exata e que já têm tratamento gracioso próprio em
 * algum outro lugar do app (ex.: `SharePreviewSheet.tsx`/
 * `week-review.tsx` já mostram um `Alert` amigável quando o `import()`
 * dinâmico de `expo-sharing` falha). Pra esses, não faz sentido
 * também cobrir a tela inteira com `FatalErrorOverlay` — ficaria
 * redundante (dois avisos pro mesmo erro, um limpo e um assustador
 * por cima). Continua indo pro `console.error` normal, só não aciona
 * o overlay nem o listener.
 *
 * Achado real (2026-10-09) — mesmo com o `import()` do `expo-sharing`
 * dentro de um `try/catch`, o Metro (carregador de módulos do React
 * Native) trata QUALQUER falha ao CARREGAR um módulo como fatal
 * automaticamente, reportando pro handler global direto — independente
 * de o código que chamou estar ou não dentro de um `try/catch`. Por
 * isso o erro "Cannot find native module" aparecia tanto no `Alert`
 * (tratamento local, funcionando) quanto neste overlay (redundante).
 */
const KNOWN_HANDLED_FATAL_PATTERNS = [/Cannot find native module/i];

function isKnownHandledFatalError(error: Error): boolean {
  const message = error?.message ?? "";
  return KNOWN_HANDLED_FATAL_PATTERNS.some((pattern) => pattern.test(message));
}

export function onGlobalError(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * DIAGNÓSTICO TEMPORÁRIO (2026-10-09) — investigação do crash de "Ver
 * todas as avaliações": o app inteiro fecha sem nenhum aviso (direto
 * pra tela inicial do celular). O relatório de crash nativo (.ips,
 * enviado pelo usuário) mostrou que é SIGABRT, disparado dentro da
 * fila `expo.controller.errorRecoveryQueue` — mecanismo do PRÓPRIO
 * `expo-updates` (não algo nosso): quando um erro de JS não é
 * capturado por NENHUM `ErrorBoundary` (o que só acontece pra erro
 * de fase de render — isto aqui é claramente um erro fora do ciclo
 * de render, ex.: dentro de um handler de evento ou callback
 * assíncrono sem `try/catch`), o React Native manda esse erro direto
 * pro handler nativo fatal; o `expo-updates` intercepta ali, tenta
 * buscar uma atualização em 5s e, se não conseguir, REJOGA o erro
 * original como exceção nativa — e essa vira o `abort()`.
 *
 * O problema: a documentação oficial do Expo confirma que, nesse
 * caminho, o relatório de crash do iOS NÃO guarda o texto da
 * exceção original (só o rastro nativo, sem a mensagem) — por isso
 * nenhum dos dois `.ips` que já olhamos tinha a causa real.
 *
 * Esta função instala nosso PRÓPRIO handler global
 * (`global.ErrorUtils`, a mesma API que o `expo-updates` usa) ANTES
 * de qualquer coisa decidir se o erro é fatal. Pra erro NÃO-fatal,
 * só registra e repassa pro handler original (comportamento
 * inalterado). Pra erro FATAL, guarda o erro completo (visível via
 * `FatalErrorOverlay.tsx`) e PROPOSITALMENTE NÃO repassa pro handler
 * original — ou seja, impede o `expo-updates`/RN de decidir abortar
 * o processo nesta etapa de diagnóstico. Troca "o app fecha sem
 * aviso" por "aparece uma tela com o erro completo, pra printar e
 * mandar" — assim que a causa raiz real for encontrada e corrigida,
 * isto deve ser removido (não é uma solução, é uma lupa temporária).
 */
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  const globalAny = global as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  };

  if (!globalAny.ErrorUtils?.setGlobalHandler) {
    console.warn("[globalErrorHandler] global.ErrorUtils não disponível — diagnóstico não instalado.");
    return;
  }

  const previousHandler = globalAny.ErrorUtils.getGlobalHandler?.();

  globalAny.ErrorUtils.setGlobalHandler((error: Error, isFatal = false) => {
    const alreadyHandled = isFatal && isKnownHandledFatalError(error);

    console.error("[globalErrorHandler]", isFatal ? (alreadyHandled ? "FATAL (já tratado em outro lugar)" : "FATAL") : "não-fatal", error);

    if (!alreadyHandled) {
      try {
        listeners.forEach((listener) => listener(error, isFatal));
      } catch (listenerError) {
        console.error("[globalErrorHandler] falha ao notificar listener", listenerError);
      }
    }

    if (!isFatal) {
      previousHandler?.(error, isFatal);
    }
    // Erro FATAL (conhecido ou não): não chama `previousHandler` — ver comentário grande acima.
  });
}
