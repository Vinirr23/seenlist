import * as SplashScreen from "expo-splash-screen";

/**
 * "Plus Jakarta Sans" (a pedido — "perfil não se parece com o web") —
 * antes, a splash nativa só esperava a SESSÃO resolver
 * (`AuthProvider.tsx`, comentário original em `app/_layout.tsx`).
 * Agora também precisa esperar a FONTE carregar (`useFonts` em
 * `app/_layout.tsx`) — sem isso, o app apareceria um instante com a
 * fonte do sistema e "pularia" pra Plus Jakarta Sans assim que
 * carregasse, um pisca perceptível. Duas fontes de "pronto"
 * independentes, sem piso de tempo fixo nenhum (mesma filosofia já
 * documentada em `app/_layout.tsx`): só esconde quando AS DUAS
 * tiverem marcado pronto, não importa a ordem que cheguem.
 */
let fontsReady = false;
let sessionReady = false;

function maybeHide() {
  if (fontsReady && sessionReady) {
    SplashScreen.hideAsync().catch(() => {
      // Ignora — só pode falhar se chamado depois do auto-hide já ter
      // acontecido (corrida rara), o que não muda nada de importante.
    });
  }
}

export function markFontsReady() {
  fontsReady = true;
  maybeHide();
}

export function markSessionReady() {
  sessionReady = true;
  maybeHide();
}
