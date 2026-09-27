/**
 * A PEDIDO (2026-09-27 — "na escolha de banner... quero que a pesquisa
 * funcione... mesmo com erro de digitação") — utilitário pequeno,
 * autocontido, sem dependência nova: comparação "aproximada" de texto,
 * pra buscas locais (filtrar uma lista já carregada em memória, nunca
 * uma chamada de rede nova).
 *
 * Resolve DOIS problemas do `includes()` puro que `LibraryImagePickerSheet.tsx`
 * usava antes:
 *   1. Acento — "Vinganca" não batia com "Vingança" (útil pra quem
 *      digita sem acento de propósito, ou erra o acento).
 *   2. Erro de digitação — uma letra trocada/faltando/a mais numa
 *      palavra ("Vingadors", "Vingadres") não batia de jeito nenhum.
 *
 * NÃO resolve busca entre idiomas (título em outro idioma) — isso
 * exigiria ter o título ORIGINAL do TMDB disponível, que a Biblioteca
 * não busca hoje (ver comentário em `LibraryImagePickerSheet.tsx`).
 */

/** Remove acento (NFD + strip dos diacríticos) e baixa a caixa — mesma técnica usada em buscas locais no resto do app (`userSearch.ts`/`search.ts` fazem só `.toLowerCase()`; aqui vai um passo além por causa do pedido de acento). */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Distância de edição clássica (Levenshtein) — quantas trocas/inserções/
 * remoções de 1 caractere levam de `a` até `b`. Usada só palavra por
 * palavra (nomes de título raramente passam de ~12 letras), então o
 * custo O(n·m) não pesa.
 *
 * CORREÇÃO (typecheck real reportado pelo usuário — `tsc --noEmit` com
 * `noUncheckedIndexedAccess` ligado no projeto) — a versão original
 * usava uma matriz `number[][]` e indexava direto (`dp[i][j]`); com
 * essa opção do compilador, TODO acesso por índice em array é tipado
 * como `T | undefined` (mesmo depois de preencher as bordas
 * manualmente, o TS não sabe disso estaticamente), e várias leituras
 * viravam erro (`Object is possibly 'undefined'`) ou atribuição de
 * `number | undefined` num `number`. Reescrito com DUAS linhas 1D
 * (`anterior`/`atual`, técnica clássica que já reduz de O(n·m) pra
 * O(n) de memória) e fallback explícito `?? 0` em toda leitura — nunca
 * deveria cair no fallback na prática (as bordas são sempre
 * preenchidas antes de qualquer leitura), é só o jeito de provar isso
 * pro compilador sem precisar de `!` espalhado.
 */
function distanciaLevenshtein(a: string, b: string): number {
  const n = b.length;
  let anterior: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  let atual: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    for (let j = 1; j <= n; j++) {
      const substituir = anterior[j - 1] ?? 0;
      const remover = anterior[j] ?? 0;
      const inserir = atual[j - 1] ?? 0;
      atual[j] = a[i - 1] === b[j - 1] ? substituir : 1 + Math.min(remover, inserir, substituir);
    }
    [anterior, atual] = [atual, anterior];
  }

  return anterior[n] ?? 0;
}

/** Quantos erros de digitação tolerar, escalado pelo tamanho da palavra — palavra curta demais com muita tolerância vira "casa com qualquer coisa" (ex.: "de"/"a"). */
function toleranciaDeErros(tamanhoDaPalavra: number): number {
  if (tamanhoDaPalavra <= 3) return 0;
  if (tamanhoDaPalavra <= 6) return 1;
  return 2;
}

/**
 * `true` se `texto` "casa" com `busca` — contém (sem se importar com
 * acento/caixa) OU cada palavra da busca tem alguma palavra
 * correspondente em `texto` a poucos erros de digitação de distância
 * (ou é prefixo dela, pra continuar funcionando enquanto a pessoa
 * ainda está digitando a palavra toda).
 */
export function textoCasaComBusca(texto: string, busca: string): boolean {
  const textoNormalizado = normalizar(texto);
  const buscaNormalizada = normalizar(busca.trim());
  if (!buscaNormalizada) return true;
  if (textoNormalizado.includes(buscaNormalizada)) return true;

  const palavrasDoTexto = textoNormalizado.split(/\s+/).filter(Boolean);
  const palavrasDaBusca = buscaNormalizada.split(/\s+/).filter(Boolean);

  return palavrasDaBusca.every((palavraBusca) =>
    palavrasDoTexto.some((palavraTexto) => {
      if (palavraTexto.startsWith(palavraBusca) || palavraBusca.startsWith(palavraTexto)) return true;
      return distanciaLevenshtein(palavraBusca, palavraTexto) <= toleranciaDeErros(palavraBusca.length);
    })
  );
}
