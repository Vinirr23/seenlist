import type { ReactNode } from "react";

/**
 * A PEDIDO (2026-08-22) — no carrossel/tela "Porque você assistiu a
 * [X]", só o NOME do título-âncora deve ficar âmbar (`text-primary`,
 * mesma cor de destaque do resto do app — ver `--color-primary` em
 * `globals.css`); o resto da frase continua com a cor de texto normal.
 *
 * Chamar `t(key)` SEM o segundo argumento (`vars`) devolve o molde da
 * tradução ainda com o placeholder literal `{title}` (ver `t()` em
 * `LocaleProvider.tsx` — só substitui se `vars` for passado). Dividir
 * a string por esse placeholder funciona em qualquer idioma e em
 * qualquer posição do `{title}` na frase, sem precisar hard-codar
 * onde o nome cai em cada tradução (pt-BR/en-US/es têm no fim hoje,
 * mas o código não depende disso).
 */
export function highlightTitle(template: string, title: string, highlightClassName = "text-primary"): ReactNode {
  const [prefix, suffix = ""] = template.split("{title}");
  return (
    <>
      {prefix}
      <span className={highlightClassName}>{title}</span>
      {suffix}
    </>
  );
}
