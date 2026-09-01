const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// CORREÇÃO (upgrade SDK 55 — achado real do `expo-doctor`, "watchFolders
// does not contain all entries from Expo's defaults") — este arquivo
// configurava `watchFolders`/`resolver.nodeModulesPaths` manualmente à
// mão (receita de ANTES do SDK 52). Desde o SDK 52, o `getDefaultConfig`
// já detecta e configura isso sozinho pra monorepo — a versão manual
// SUBSTITUÍA (não somava) o que o Expo já monta por padrão, escondendo
// entradas que o `expo-doctor` espera encontrar. Removido, seguindo a
// recomendação atual (docs.expo.dev/guides/monorepos): "You don't have
// to manually configure Metro when using monorepos if you use
// expo/metro-config". Só a correção abaixo (não relacionada a monorepo)
// continua manual.
//
// Causa raiz do erro "ws/lib/stream.js attempted to import the Node
// standard library module 'stream'" durante o bundle Android:
//
// Desde RN 0.72+, o Metro resolve `package.json`'s `exports` por
// padrão (`unstable_enablePackageExports` já vem `true`), e pra React
// Native as condições padrão são ['require', 'react-native']. O
// `@supabase/realtime-js` tem um bug conhecido e ainda em aberto
// (github.com/supabase/realtime-js/issues/415): ele não declara uma
// condição "react-native" que evite `ws` — com as condições padrão,
// o Metro cai no branch voltado pra Node do pacote, que importa `ws`,
// que importa `stream` (que não existe no runtime do React Native).
//
// A correção NÃO é desabilitar `exports` globalmente (afetaria todo
// pacote do projeto que usa `exports`, não só o Supabase), nem
// substituir a lista de condições inteira por só `["browser"]"`
// (arriscaria quebrar outros pacotes que dependem especificamente da
// condição "react-native" pra resolver sua build correta). É colocar
// "browser" com prioridade mais alta, mantendo "require"/"react-native"
// como fallback pra todo o resto: o Supabase também publica um build
// voltado pra browser, que usa o `WebSocket` global nativo (que tanto
// navegador quanto React Native já têm) e NUNCA importa `ws` —
// elimina a dependência por completo, sem alterar a resolução de
// nenhum outro pacote do projeto.
config.resolver.unstable_conditionNames = ["browser", "require", "react-native"];

module.exports = config;
