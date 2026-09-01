"use client";

import { EMPTY_LIBRARY_COUCH_SCENE_SVG_INNER } from "./emptyLibraryCouchSceneSvg";

/**
 * A PEDIDO (2026-09-01 -- "quero transformar o empty state... numa
 * animação premium, extremamente sutil... cinematic UI / premium
 * streaming app / ambient motion / Apple-like subtle animation") --
 * histórico completo do processo, pra quem for mexer aqui depois:
 *
 * 1) Pedido original descrevia luminária, reflexo, gato, planta e
 *    manta como CAMADAS separadas de um SVG. Não existia nenhum SVG
 *    assim no projeto -- nem a ilustração anterior, nem a primeira
 *    versão desta (`empty-library-scene.png`) eram nada além de PNG
 *    achatado. Avisado ao usuário antes de inventar qualquer coisa.
 *
 * 2) Usuário enviou `seenlist_sofa_true_vector.svg` (3 tentativas de
 *    upload pelo chat falharam sem chegar ao ambiente -- só funcionou
 *    depois de salvar o arquivo na pasta do projeto e ler direto do
 *    computador). CONFERIDO antes de usar (não assumido): é um
 *    auto-trace da imagem original -- 2235 elementos `<path>`, ZERO
 *    `<g>`/`id` nativos, só 49 cores sólidas (degradês do original
 *    "achatados" em bandas -- dá pra ver um leve efeito de "linhas de
 *    contorno" comparado à imagem lisa anterior). Fundo é transparente
 *    de verdade (confirmado renderizando sobre magenta E sobre o fundo
 *    real do app) -- ao contrário do PNG anterior, que tinha uma
 *    "vinheta" oval ocupando quase a tela toda.
 *
 * 3) Como não existiam grupos nativos, os 2235 paths foram reagrupados
 *    por um script (fora do repo) em 7 grupos, por REGIÃO ESPACIAL
 *    (bounding box de cada path no arquivo fonte 1536×1024) + filtro
 *    de COR (pra separar, por ex., o brilho quente da luminária do
 *    encosto escuro dela, que caem na mesma região): `scene-cat`,
 *    `scene-plant-leaves`, `scene-blanket`, `scene-lamp-fixture`
 *    (estático -- luminária/braço, não anima), `scene-lamp-glow`
 *    (brilho, anima opacidade), `scene-sparkle-1`/`scene-sparkle-2`
 *    (as 2 estrelinhas isoladas que existem de verdade no arquivo,
 *    identificadas pelo pico de brilho + tamanho compacto, não
 *    inventadas). O resto (sofá, pipoca, sombra do chão etc.) fica
 *    como base estática, na ordem original do arquivo.
 *
 *    Essa reagrupagem é HEURÍSTICA (bounding box + cor, sem metadado
 *    de verdade dizendo "isto é o gato") -- verificado visualmente
 *    ANTES de integrar: cada grupo isolado foi renderizado sozinho
 *    (composto sobre magenta) pra conferir se saiu limpo, e a versão
 *    final reordenada (grupos animáveis movidos pro fim do documento,
 *    pra poder ter um `<g>` cada um) foi comparada pixel a pixel com o
 *    render original -- diferença de 263 pixels em 1.572.864 (0,017%),
 *    toda ela nuance de sombreado sub-pixel dentro da orelha do gato,
 *    não erro de sobreposição. Mesmo assim, ALGUM fragmento decorativo
 *    (uma linha de acabamento do sofá, por ex.) pode ter ficado no
 *    grupo errado -- em amplitudes tão pequenas (0,5-1% de escala, 1-2°
 *    de rotação) isso não deve ser perceptível, mas é um risco
 *    conhecido, não uma garantia.
 *
 *    "Reflexo da luz" (item 2 do pedido original, luz variando sobre
 *    sofá/manta/chão) e o timing individual por folha (item 4) NÃO
 *    foram implementados à parte -- não dá pra isolar por bounding
 *    box um destaque que está misturado nas próprias cores do sofá, e
 *    dividir a planta em sub-grupos por folha exigiria outra rodada
 *    inteira de agrupamento. Simplificações conscientes, não
 *    esquecidas.
 *
 * 4) PERFORMANCE: 2235 elementos `<path>` inline no DOM (~520KB de
 *    marcação) é MUITO mais pesado que o PNG raster que esta tela
 *    usava antes (~330KB, e sem nenhum nó de DOM extra, decodificado
 *    fora da main thread). É o preço de ter elementos de verdade pra
 *    animar. O texto do SVG é repetitivo (padrão `<path fill="#xxxxxx"
 *    d="...">` inteiro), então comprime bem com gzip/brotli (que o
 *    Next.js já aplica no bundle) -- mas ainda assim é mais dado
 *    trafegado e mais nós de DOM que a imagem. Avisado ao usuário
 *    antes de implementar; ele optou por seguir mesmo assim.
 *
 * `dangerouslySetInnerHTML` aqui é seguro -- o conteúdo é 100%
 * estático, gerado uma vez por este processo, nunca depende de input
 * do usuário nem de dado de rede.
 *
 * Todas as animações ficam em `globals.css` (classes `.scene-*`),
 * dentro de `prefers-reduced-motion: no-preference` -- ver comentário
 * lá pro motivo. CSS puro (`transform`/`opacity`, GPU), sem
 * `requestAnimationFrame`, sem lib nova.
 */
export function EmptyLibraryCouchScene() {
  return (
    <svg
      viewBox="0 0 1536 1024"
      className="h-full w-full"
      role="img"
      aria-label=""
      // eslint-disable-next-line react/no-danger -- ver comentário acima: conteúdo estático, gerado por script, não é input do usuário.
      dangerouslySetInnerHTML={{ __html: EMPTY_LIBRARY_COUCH_SCENE_SVG_INNER }}
    />
  );
}
