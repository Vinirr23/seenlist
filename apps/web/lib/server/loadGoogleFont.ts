/**
 * `ImageResponse` (a API do Next pra gerar `opengraph-image`) é
 * renderizada pelo `satori`, que não entende `<link>` de fonte nem CSS
 * — precisa dos BYTES reais do arquivo da fonte. A API `css2` do
 * Google Fonts não serve um .ttf fixo por URL direta (o endereço muda
 * por subset/versão); o jeito documentado pelos próprios exemplos do
 * Next.js é pedir o CSS da família, ler a URL real de dentro da regra
 * `@font-face` que ela devolve, e então baixar ESSE arquivo.
 *
 * `User-Agent` antigo de propósito: a API do Google Fonts decide o
 * FORMATO do arquivo pelo header — sem isso ela só oferece woff2, que
 * o `satori` não lê (precisa de ttf/otf).
 */
const LEGACY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36";

export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const css = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_USER_AGENT } }).then((res) => res.text());

  const fontUrlMatch = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
  // `fontUrlMatch[1]` (o grupo capturado) também cai na regra de
  // `noUncheckedIndexedAccess` — o `if (!fontUrlMatch)` acima só prova
  // que o array existe, não que a posição 1 tem valor; guardar numa
  // variável com o próprio check resolve.
  const fontUrl = fontUrlMatch?.[1];
  if (!fontUrl) {
    throw new Error(`[loadGoogleFont] Não encontrei a URL da fonte "${family}" peso ${weight} na resposta da API do Google Fonts.`);
  }

  const fontResponse = await fetch(fontUrl);
  return fontResponse.arrayBuffer();
}
