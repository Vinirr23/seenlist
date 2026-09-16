import type { GlowBlob } from "@/components/ui";

/**
 * PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas das
 * SUB-TELAS (as que abrem por cima de uma aba, com cabeçalho "voltar +
 * título"). No web esse MESMO campo — mesmos valores, sem uma variação
 * sequer — está copiado em pelo menos quatro arquivos:
 * `CommentsPageView.tsx` (comentários de uma mídia),
 * `MyCommentsPageView.tsx` ("Meus comentários"), `ListsPageView.tsx`
 * (Minhas listas) e `UserListPageView.tsx` (Seguidores/Seguindo).
 *
 * Aqui no mobile ele serve às mesmas telas (`profile/comments.tsx`,
 * `series|movies/[id]/reviews.tsx`, `lists/index.tsx`, `lists/[id].tsx`,
 * `follow-list/[userId]/[direction].tsx`) — em vez de copiar o array
 * seis vezes (o web só não sofre tanto porque lá são quatro cópias, e
 * já é duplicação), fica num lugar só.
 *
 * NÃO se aplica às telas com paleta PRÓPRIA, que continuam declarando
 * o array na própria tela, como sempre estiveram: `PROFILE_GLOW_BLOBS`
 * (`app/(tabs)/profile.tsx`, 8 manchas), `SETTINGS_GLOW_BLOBS`
 * (`app/settings/index.tsx`, 4) e `PUBLIC_PROFILE_GLOW_BLOBS`
 * (`app/u/[username]/index.tsx`, 6).
 *
 * Conversão (mesma técnica das outras): `top` copiado em pixel 1:1 do
 * web; `left`/`right` do web são % da coluna, convertidos assumindo
 * ~400px de largura de referência (-22% → -88, -20% → -80, -18% → -72);
 * `size` é a caixa (`h-64`=256, `h-60`=240, `h-56`=224); a opacidade
 * (`opacity-45`/`40`/`35`, classe separada no web) entra embutida no
 * alpha do `rgba`.
 */
/**
 * GEOMETRIA (2026-09-09, refeita — medida por AJUSTE GAUSSIANO no
 * perfil horizontal de azul dos dois prints, não mais por "olhar a
 * área vazia"): os `left`/`right` são o deslocamento do web em PIXEL,
 * direto, SEM recorte nenhum.
 *
 * A conversão anterior (`web% × 500 − 44.5`) estava errada e o erro era
 * sistemático: as três manchas ficavam exatamente 44dp MAIS PRA FORA
 * do que no web. Medido, centro de cada mancha:
 *
 *     mancha        web              mobile (antes)
 *     topo/esq      18px DENTRO      26dp FORA
 *     meio/dir      20px DENTRO      24dp FORA
 *     baixo/esq     22px DENTRO      22dp FORA
 *
 * Com o núcleo fora da tela, só o FLANCO da mancha aparecia — daí ela
 * parecer mais fraca que a do web mesmo com amplitude e blur certos
 * (A=57 contra 55 do web, sigma=82px contra 83px: já batiam).
 *
 * Por que o recorte era errado: a mancha é ancorada numa BORDA
 * (`left`/`right`), não no centro da coluna. A borda direita do celular
 * é a borda direita da coluna — não há o que recortar. Descontar
 * (500−411)/2 tratava a tela como uma janela centralizada sobre a
 * coluna do web, o que só valeria pra algo ancorado no centro.
 *
 * A porcentagem do web também não serve aplicada aos 411dp: `-20%` de
 * 411 dá −82 e joga a mancha pra DENTRO. O que reproduz o web é a
 * distância em pixel até a borda, que é a mesma nos dois:
 * `-22% → -110`, `-20% → -100`, `-18% → -90`, `-16% → -80`, `-14% → -70`
 * (a coluna do web mede 500px — confirmado pelo botão "Criar nova
 * lista": 468px no print + `px-4` dos dois lados, com zoom 1.0).
 */
/*
 * PARIDADE DE BRILHO (2026-09-16, a pedido — "a iluminação da aba
 * home/séries está diferente das outras telas, deixe todas iguais a
 * ela"). Este array (e os outros três abaixo, `SERIES_DETAILS_`/
 * `MOVIE_DETAILS_`/`EPISODE_DETAILS_GLOW_BLOBS`) usava as opacidades
 * ORIGINAIS de antes do ajuste de brilho pedido pra Séries/Filmes —
 * ficou mais escuro que `HOME_GLOW_BLOBS` sem nenhuma razão de design,
 * só porque o ajuste foi pedido e aplicado só naquela tela. Aqui
 * aplica-se o MESMO fator combinado das duas rodadas de lá (×1.45 ×
 * 1.20 = ×1.74), pra cada opacidade ficar igual à mancha da mesma cor
 * em `HOME_GLOW_BLOBS` (0.45→0.78, 0.4→0.7, 0.35→0.61, 0.24→0.42) —
 * não se aplica a `PROFILE_GLOW_BLOBS`/`SETTINGS_GLOW_BLOBS`/
 * `PUBLIC_PROFILE_GLOW_BLOBS`, que têm paleta própria (ver comentário
 * no topo do arquivo), não uma variação mais escura desta.
 */
export const SUBPAGE_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 40, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 320, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.61)", top: 620, left: -90, size: 224 },
];

/**
 * PORTE DO WEB (2026-09-09) — o campo de manchas das telas que ainda
 * não tinham nenhum. Levantado comparando quais views do web têm
 * `blur-[60px]` com quais telas do mobile tinham `GlassTargetProvider`:
 * faltavam cinco.
 *
 * Os cinco arrays do web são o MESMO desenho (mesmas cores, tamanhos e
 * porcentagens) deslocado verticalmente conforme o que existe acima na
 * página — por isso só o `top` muda entre eles. Sizes: `h-64`=256,
 * `h-60`=240, `h-56`=224, `h-48`=192. Os `left`/`right` seguem a mesma
 * conversão já validada e explicada acima (deslocamento do web em
 * pixel, sem recorte): -22%→-110, -20%→-100, -18%→-90, -16%→-80.
 */

/** `SeriesHome.tsx` e `MoviesHome.tsx` — arrays idênticos no web. */
/*
 * AJUSTE (2026-09-16, a pedido — "ilumina um pouco mais as manchas... você
 * está mexendo na mancha errada, não é a mancha dentro do glass e sim a
 * mancha azul do fundo"). As rodadas anteriores de "ilumina X%" foram
 * aplicadas por erro no `highlight` do `card` (revertido em `theme.ts`) —
 * aqui é a primeira tentativa no alvo certo, não dá pra repetir a mesma
 * cadeia de porcentagens (foi calibrada contra outra coisa, numa escala
 * visual bem menor que estas manchas de tela cheia). Primeiro passo:
 * opacidade de cada mancha × 1.45 (mesmo primeiro pedido, "uns 45%"),
 * como novo ponto de partida pra iterar.
 *
 * RODADA 2 (2026-09-16, a pedido — "aumenta a iluminação uns 20%"):
 * cada opacidade × 1.20.
 */
export const HOME_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 40, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 280, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.78)", top: 520, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.61)", top: 740, right: -90, size: 224 },
  { color: "rgba(13,59,92,0.42)", top: 950, left: -80, size: 192 },
];

/** `SeriesDetailsView.tsx` — mesmo desenho, começando mais embaixo (o herói da série ocupa o topo). */
export const SERIES_DETAILS_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 300, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 540, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.78)", top: 780, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.61)", top: 1000, right: -90, size: 224 },
  { color: "rgba(13,59,92,0.42)", top: 1210, left: -80, size: 192 },
];

/** `MovieDetailsView.tsx`. */
export const MOVIE_DETAILS_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 340, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 580, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.78)", top: 820, left: -90, size: 256 },
  { color: "rgba(42,127,184,0.61)", top: 1040, right: -90, size: 224 },
  { color: "rgba(13,59,92,0.42)", top: 1250, left: -80, size: 192 },
];

/** `EpisodeDetailView.tsx` — só três manchas no web, não cinco. */
export const EPISODE_DETAILS_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 460, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 700, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.61)", top: 950, left: -90, size: 224 },
];
