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

  // CAUSA RAIZ (2026-10-08, erro 500 real em produção — "Não encontrei
  // a URL da fonte... peso 800"): a regra original exigia bater o
  // trecho EXATO `format('truetype')`/`format('opentype')`, aspas
  // simples incluídas. A resposta de verdade da API do Google Fonts
  // não é um contrato estável (varia por família, por peso, e pode
  // mudar sem aviso) — bastou ela vir com aspas diferentes, outro
  // rótulo de formato, ou `local(...)` antes do `url(...)` pra regex
  // não casar nada, e aí a função falhava pra TODO peso dessa família
  // em produção, derrubando a rota inteira com 500.
  //
  // Correção pela raiz: em vez de exigir o formato exato do `format(...)`,
  // pega QUALQUER `url(...)` do CSS e prioriza o que termina em
  // `.ttf`/`.otf` (os únicos que o `satori` lê) — não importa a sintaxe
  // ao redor. Se nada bater, o erro agora inclui um trecho do CSS de
  // verdade recebido, pra não precisar adivinhar de novo da próxima vez.
  const urlMatches = [...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1]).filter((url): url is string => Boolean(url));
  const fontUrl = urlMatches.find((url) => /\.(ttf|otf)(\?|$)/i.test(url)) ?? urlMatches[0];

  if (!fontUrl) {
    throw new Error(
      `[loadGoogleFont] Não encontrei nenhuma URL de fonte "${family}" peso ${weight} na resposta da API do Google Fonts. Trecho recebido: ${css.slice(0, 300)}`
    );
  }

  const fontResponse = await fetch(fontUrl);
  return fontResponse.arrayBuffer();
}
