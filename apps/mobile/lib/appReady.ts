/**
 * "Plus Jakarta Sans" (a pedido — "perfil não se parece com o web") —
 * antes, a splash nativa só esperava a SESSÃO resolver
 * (`AuthProvider.tsx`, comentário original em `app/_layout.tsx`).
 * Depois também passou a esperar a FONTE carregar (`useFonts` em
 * `app/_layout.tsx`) — sem isso, o app apareceria um instante com a
 * fonte do sistema e "pularia" pra Plus Jakarta Sans assim que
 * carregasse, um pisca perceptível. Duas fontes de "pronto"
 * independentes, sem piso de tempo fixo nenhum (mesma filosofia já
 * documentada em `app/_layout.tsx`) — só considera "pronto de
 * verdade" quando AS DUAS tiverem marcado pronto, não importa a
 * ordem que cheguem.
 *
 * CORREÇÃO (2026-10-06, splash animada aprovada em mockup — fade +
 * flash de 1200ms sobre o símbolo) — este módulo NÃO esconde mais a
 * splash nativa sozinho (`SplashScreen.hideAsync()` saiu daqui).
 * Quem decide isso agora é `components/layout/AnimatedSplash.tsx`:
 * esconde a splash nativa assim que a PRÓPRIA camada JS pinta o
 * primeiro frame (pra não esperar fontes/sessão pra começar a
 * animação — ver comentário grande lá), e só revela o app de
 * verdade quando a animação (1200ms) E a leitura daqui (`isAppReady`)
 * tiverem terminado, o que vier depois — "opção 2" entre as duas
 * discutidas: a animação roda em PARALELO ao carregamento real, não
 * sempre em cima dele. Este módulo virou só a fonte de verdade de
 * "fontes prontas"/"sessão pronta", lido via `isFontsReady`/
 * `isAppReady` ou assinado via `onFontsReady`/`onAppReady`.
 */
type Listener = () => void;

function createFlag() {
  let ready = false;
  const listeners = new Set<Listener>();
  return {
    mark() {
      if (ready) return;
      ready = true;
      listeners.forEach((listener) => listener());
    },
    isReady: () => ready,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      if (ready) listener();
      return () => listeners.delete(listener);
    },
  };
}

const fontsFlag = createFlag();
const sessionFlag = createFlag();

export function markFontsReady() {
  fontsFlag.mark();
}

export function markSessionReady() {
  sessionFlag.mark();
}

export function isFontsReady(): boolean {
  return fontsFlag.isReady();
}

export function isAppReady(): boolean {
  return fontsFlag.isReady() && sessionFlag.isReady();
}

/** Chama `listener` assim que a fonte custom terminar de carregar (ou já chama na hora, se já tiver terminado). */
export function onFontsReady(listener: Listener): () => void {
  return fontsFlag.subscribe(listener);
}

/** Chama `listener` assim que fontes E sessão estiverem prontas (ou já chama na hora, se as duas já estiverem). */
export function onAppReady(listener: Listener): () => void {
  const checkBoth = () => {
    if (isAppReady()) listener();
  };
  const unsubscribeFonts = fontsFlag.subscribe(checkBoth);
  const unsubscribeSession = sessionFlag.subscribe(checkBoth);
  return () => {
    unsubscribeFonts();
    unsubscribeSession();
  };
}
