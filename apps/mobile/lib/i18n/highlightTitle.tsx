import { Text } from "react-native";
import { colors } from "../theme";

/**
 * PORTE DO WEB (2026-09-02, reformulação completa da Explorar) —
 * versão RN de `apps/web/lib/i18n/highlightTitle.tsx`: no carrossel
 * "Porque você assistiu a [X]", só o NOME do título-âncora fica âmbar
 * (mesma cor de destaque do resto do app, `colors.primary`), o resto
 * da frase continua na cor de texto normal. Chamar `t(key)` SEM o
 * segundo argumento (`vars`) devolve o molde ainda com o placeholder
 * literal `{title}` (ver `t()` em `LocaleProvider.tsx` — só substitui
 * se `vars` for passado) — dividir por esse placeholder funciona em
 * qualquer idioma/posição, sem hard-codar onde o nome cai em cada
 * tradução.
 *
 * Diferente da versão web (que devolve um `<span>` dentro de
 * qualquer elemento): RN não permite `View`/ícone livre dentro de
 * `Text`, mas TEXTO aninhado dentro de `Text` funciona normalmente —
 * por isso aqui devolve um Fragment com `<Text>` aninhado pro trecho
 * colorido, pra usar direto como filho de outro `<Text>` (mesma forma
 * de uso: `<Text>{highlightTitle(template, title)}</Text>`).
 */
export function highlightTitle(template: string, title: string) {
  const [prefix, suffix = ""] = template.split("{title}");
  return (
    <>
      {prefix}
      <Text style={{ color: colors.primary }}>{title}</Text>
      {suffix}
    </>
  );
}
