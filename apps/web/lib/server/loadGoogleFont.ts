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
  // CAUSA RAIZ (2026-10-08, investigação dos bytes pequenos demais —
  // testei a URL de fora e ela devolve um .ttf de verdade, então a
  // extração em si está correta) — ambas as chamadas de `fetch` aqui
  // rodam dentro de uma rota do Next.js, que por padrão GUARDA EM CACHE
  // o resultado de `fetch` (Data Cache) — se em algum deploy anterior,
  // antes da correção do bug de regex (comentário abaixo), uma dessas
  // chamadas tiver sido cacheada com uma resposta pequena/de erro, esse
  // resultado ruim podia ficar preso indefinidamente, sobrevivendo a
  // deploys novos, mesmo com o código de extração já corrigido.
  // `cache: "no-store"` força buscar de novo sempre, nunca usar/gravar
  // cache — cada weight dessa fonte muda raramente mesmo (o `revalidate`
  // de 1h da ROTA inteira já limita quantas vezes isso roda de verdade).
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const css = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_USER_AGENT }, cache: "no-store" }).then((res) => res.text());

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

  // CAUSA RAIZ (2026-10-08, nome e estatísticas do card de perfil saindo
  // com peso de fonte errado/pesado demais, mesmo trocando o `fontWeight`
  // declarado) — log de diagnóstico mostrou a "fonte" carregando só ~1.6KB,
  // bytes demais pra ser erro de rede (que cairia no catch de
  // `loadGoogleFontSafe` e devolveria null), de menos pra ser uma fonte
  // .ttf/.otf de verdade (sempre centenas de KB). Esta função nunca
  // checava `fontResponse.ok` nem o tamanho do corpo — se `fontUrl`
  // apontasse pra algo errado (resposta de erro servida com 200, corpo
  // vazio, redirecionamento pra uma página pequena), os bytes errados
  // eram devolvidos como se fossem a fonte, e o satori tentava desenhar
  // isso — resultado imprevisível (o "peso mais black" visto no card).
  // Agora valida `ok` E um tamanho mínimo plausível antes de aceitar o
  // resultado, lançando um erro descritivo (com a URL de verdade usada)
  // em vez de devolver silenciosamente bytes inválidos — assim
  // `loadGoogleFontSafe` cai pro `null`/fonte padrão de forma correta,
  // em vez de entregar uma "fonte" corrompida pro satori.
  const fontResponse = await fetch(fontUrl, { cache: "no-store" });
  if (!fontResponse.ok) {
    throw new Error(
      `[loadGoogleFont] A URL da fonte "${family}" peso ${weight} respondeu ${fontResponse.status} ${fontResponse.statusText} (não é o arquivo da fonte). URL: ${fontUrl}`
    );
  }
  const buffer = await fontResponse.arrayBuffer();
  if (buffer.byteLength < 10_000) {
    throw new Error(
      `[loadGoogleFont] A URL da fonte "${family}" peso ${weight} devolveu só ${buffer.byteLength} bytes — pequeno demais pra ser uma fonte .ttf/.otf de verdade. URL: ${fontUrl}`
    );
  }
  return buffer;
}

/**
 * BUG REAL CORRIGIDO (2026-10-08, "falha universal" reportada — TODA
 * imagem de review/perfil falhando, não só uma específica) — causa
 * raiz: nenhuma rota `opengraph-image.tsx` tinha try/catch em volta de
 * `loadGoogleFont`. Essa chamada roda incondicionalmente, ANTES de
 * qualquer lógica de conteúdo (dentro do mesmo `Promise.all` que busca
 * os dados) — qualquer falha nela (timeout pro Google Fonts, resposta
 * que mudou de formato de novo, falha de rede do próprio Vercel Edge)
 * derrubava a rota inteira com 500, pra QUALQUER review/perfil,
 * sempre, já que não depende do conteúdo sendo buscado.
 *
 * Esta função nunca lança — se a fonte real falhar por qualquer
 * motivo, devolve `null` e quem chama usa a fonte padrão do `satori`
 * (sans-serif do sistema) em vez de quebrar a imagem inteira. Pior
 * caso agora é uma imagem com fonte genérica, nunca um erro 500.
 */
export async function loadGoogleFontSafe(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    return await loadGoogleFont(family, weight);
  } catch (error) {
    console.error(`[loadGoogleFont] Falha ao carregar "${family}" peso ${weight} — seguindo com fonte padrão`, error);
    return null;
  }
}
