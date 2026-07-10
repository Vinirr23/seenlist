const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Receita oficial atual do Expo pra monorepo (docs.expo.dev/guides/monorepos),
// SDK 54 — sem customização extra além do que o próprio guia pede.
//
// 1. Observa o monorepo inteiro, não só apps/mobile — sem isso, o
// Metro não vê os pacotes irmãos (@seenlist/ui, @seenlist/types etc.)
// nem os node_modules hoisted na raiz.
config.watchFolders = [monorepoRoot];

// 2. Onde procurar node_modules, e em que ordem — primeiro local
// (apps/mobile/node_modules, se algo estiver instalado só ali),
// depois a raiz do monorepo (onde o pnpm hoisted concentra a maior
// parte dos pacotes).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Causa raiz do erro "ws/lib/stream.js attempted to import the Node
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
