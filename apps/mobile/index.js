// Ponto de entrada explícito, LOCAL ao pacote apps/mobile — não é um
// App.tsx tradicional, é o próprio mecanismo do expo-router, só
// tornado explícito em vez de depender do Metro resolver
// "expo-router/entry" através do node_modules hoisted do monorepo.
//
// Causa raiz do "Unable to resolve '../../App' from
// 'node_modules/expo/AppEntry.js'": com `main: "expo-router/entry"`
// apontando direto pro pacote, em alguns cenários de monorepo com
// pnpm hoisted o Metro/Expo CLI não resolve esse caminho de forma
// confiável e cai no fallback padrão do Expo (`expo/AppEntry.js`),
// que por sua vez tenta carregar um App.tsx clássico que nunca
// existiu neste projeto (TASK-001 — expo-router desde o início).
//
// Ter esse arquivo aqui, físico dentro de apps/mobile, remove a
// ambiguidade: não há mais resolução de pacote nenhuma envolvida,
// só um import relativo de um arquivo que garantidamente está no
// lugar certo.
import "expo-router/entry";
