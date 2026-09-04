module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // IMPLEMENTAÇÃO (2026-09-04 — animação "marcar episódio como
    // assistido").
    //
    // CORREÇÃO (mesmo dia, achado ao ler a documentação oficial ANTES
    // de assumir que o nome de sempre ainda valia — a versão instalada
    // de verdade pelo usuário foi a 4.2.1) — a partir do Reanimated 4,
    // o plugin do Babel foi MOVIDO pro pacote `react-native-worklets`
    // (não é mais `react-native-reanimated/plugin`). Usar o nome antigo
    // ainda funciona por enquanto (aviso de depreciação), mas como esta
    // é uma instalação nova, não faz sentido começar já com algo
    // depreciado. Precisa ser SEMPRE o ÚLTIMO item da lista de plugins
    // (regra da documentação oficial, não mudou).
    //
    // Precisa rodar (dentro de apps/mobile), NESTA ORDEM:
    //   npx expo install react-native-worklets
    // (react-native-reanimated já foi instalado — mas o Reanimated 4
    // exige o `react-native-worklets` como pacote SEPARADO, não vem
    // junto sozinho; versão compatível com reanimated 4.2.1: worklets
    // 0.7.x/0.8.x, o `expo install` escolhe certo sozinho).
    plugins: ["react-native-worklets/plugin"],
  };
};
