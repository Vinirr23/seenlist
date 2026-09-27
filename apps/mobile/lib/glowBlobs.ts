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

/**
 * `EpisodeDetailView.tsx` — só três manchas no web, não cinco (mesmo
 * bug existe lá, fora do escopo desta correção — só mobile foi pedido).
 *
 * CORREÇÃO (bug real, reportado — "porque a tela de reações não
 * recebeu glass?") — as 3 manchas originais só cobriam até ~1062px
 * (950 + metade do tamanho 224), ou seja, até a seção "onde assistiu".
 * A tela cresceu bem depois disso (Sua nota, Como você se sentiu —
 * grade de humor, que é alta —, Personagem favorito, card de
 * informações), então rolando pra baixo ficava tudo sem nenhum brilho,
 * só fundo escuro chapado. As 2 manchas novas (4ª e 5ª) continuam a
 * MESMA progressão das 3 originais (~240px de intervalo, alternando
 * lado), com a opacidade 0.42 — o último degrau da mesma paleta de 4
 * tons já usada em `HOME_GLOW_BLOBS`/`MOVIE_DETAILS_GLOW_BLOBS`/
 * `SERIES_DETAILS_GLOW_BLOBS` (0.78/0.7/0.61/0.42), reaproveitado duas
 * vezes aqui (como o próprio 0.42 já é o mais fraco, repetir ele pras
 * duas últimas mantém o efeito de "desvanecer" no fim da tela, igual
 * às outras três telas já fazem com a mancha final).
 */
export const EPISODE_DETAILS_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(27,75,122,0.78)", top: 460, left: -110, size: 256 },
  { color: "rgba(42,127,184,0.7)", top: 700, right: -100, size: 240 },
  { color: "rgba(13,59,92,0.61)", top: 950, left: -90, size: 224 },
  { color: "rgba(42,127,184,0.42)", top: 1190, right: -90, size: 224 },
  { color: "rgba(13,59,92,0.42)", top: 1420, left: -80, size: 192 },
];

/**
 * Week Review — paleta própria violeta/magenta (2026-09-23, rodada de
 * "vidro/glow/ícones" da sessão de 2026-09-23), simulando a extração
 * de cor dominante do backdrop (mockup v12: `--work-violet`/
 * `--work-magenta`). Calibrada e refinada em várias rodadas de
 * feedback só na tela de teste (`app/week-review-test.tsx`) — quando a
 * tela real (`app/week-review.tsx`, rodada 26) precisou do MESMO
 * visual (mesmo hero validado, mesma paleta), o array subiu pra cá em
 * vez de ser copiado pela segunda vez — mesmo raciocínio de
 * `SUBPAGE_GLOW_BLOBS`/`HOME_GLOW_BLOBS` acima, que já são
 * compartilhados entre várias telas. As duas telas do Week Review
 * importam esta constante; não há mais cópia local em nenhuma delas.
 */
export const WEEK_REVIEW_GLOW_BLOBS: GlowBlob[] = [
  { color: "rgba(76,42,140,0.55)", top: 20, left: -100, size: 256 },
  { color: "rgba(201,63,176,0.38)", top: 300, right: -90, size: 240 },
  { color: "rgba(76,42,140,0.35)", top: 620, left: -80, size: 224 },
];

/**
 * Extração de cor dominante do backdrop (pendência atacada logo depois
 * da rodada 29, mesma sessão) — decisão confirmada com o usuário via
 * `AskUserQuestion`: calcular a cor no SERVIDOR (`week-review-pregenerate`,
 * Deno, decodificador JPEG puro-JS) em vez de biblioteca nativa no app,
 * que exigiria build de dev client novo (mesmo problema das rodadas
 * 19-20 com `react-native-view-shot`/`expo-sharing`). O servidor grava
 * só a cor "crua" (`dominant_color`, média de pixel filtrada, hex) —
 * o ajuste pra virar cor de GLOW de verdade (saturação/luminosidade
 * dentro da faixa que a paleta fixa já ocupava, mais a cor secundária)
 * fica aqui, pra não duplicar essa conta em Deno E em React Native.
 *
 * Escopo confirmado com o usuário (segunda pergunta, mesma rodada): só
 * o GLOW ambiente usa a cor extraída. O tint do gradiente sobre a
 * imagem, a borda do card e a marca de aspas da citação continuam com
 * a cor fixa — mudar isso é pendência separada, não decidida agora.
 *
 * `dominantColorHex` nulo (linha sem a coluna preenchida, extração
 * falhou pro usuário, ou a tela caiu no caminho ao vivo sem
 * pré-geração) sempre cai pro `WEEK_REVIEW_GLOW_BLOBS` fixo acima —
 * nunca quebra o glow, só perde a personalização por obra.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1]!, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return { r: Math.round((rp + m) * 255), g: Math.round((gp + m) * 255), b: Math.round((bp + m) * 255) };
}

/**
 * Satura/ilumina dentro da faixa que a paleta fixa já ocupava (violeta
 * ≈ S0.55/L0.36, magenta ≈ S0.52/L0.52) — evita um glow lavado (foto
 * muito neutra/cinza) ou estourado (foto muito saturada/clara).
 */
function clampForGlow(h: number, s: number, l: number): { h: number; s: number; l: number } {
  return { h, s: Math.min(0.7, Math.max(0.4, s)), l: Math.min(0.5, Math.max(0.28, l)) };
}

export function buildWeekReviewGlowBlobs(dominantColorHex: string | null): GlowBlob[] {
  const rgb = dominantColorHex ? hexToRgb(dominantColorHex) : null;
  if (!rgb) return WEEK_REVIEW_GLOW_BLOBS;

  const base = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const primary = clampForGlow(base.h, base.s, base.l);
  // +55° de matiz, um pouco mais claro — imita a relação violeta→magenta
  // da paleta fixa original (mesmo "salto" de tom entre as duas cores).
  const secondary = clampForGlow((base.h + 55) % 360, base.s, Math.min(0.5, base.l + 0.14));

  const primaryRgb = hslToRgb(primary.h, primary.s, primary.l);
  const secondaryRgb = hslToRgb(secondary.h, secondary.s, secondary.l);
  const toRgba = (color: { r: number; g: number; b: number }, alpha: number) => `rgba(${color.r},${color.g},${color.b},${alpha})`;

  // Mesmas posições/tamanhos/opacidades de WEEK_REVIEW_GLOW_BLOBS — só a cor muda.
  return [
    { color: toRgba(primaryRgb, 0.55), top: 20, left: -100, size: 256 },
    { color: toRgba(secondaryRgb, 0.38), top: 300, right: -90, size: 240 },
    { color: toRgba(primaryRgb, 0.35), top: 620, left: -80, size: 224 },
  ];
}
