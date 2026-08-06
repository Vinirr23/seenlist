import { Tv, Clapperboard, Compass, User, type LucideIcon } from "lucide-react";

export type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * TASK-019 (reestruturação): de volta a 4 abas, igual ao TV Time de
 * verdade (confirmado pelas capturas de referência) — "Minha Lista"
 * não é mais um item da barra, virou uma sub-aba dentro da própria
 * tela de Séries ("MINHA LISTA" / "EM BREVE"). A rota /library foi
 * removida — nada nela se perdeu, a lógica (hooks de
 * `lib/queries/library`) continua em uso, só a tela mudou de lugar.
 *
 * TASK-072 — 5ª aba: "Feed", que antes era uma sub-aba dentro de
 * Explorar. Ganhou lugar próprio na barra porque é conteúdo social
 * (posts de outras pessoas), diferente de Explorar (buscar/descobrir
 * títulos) — misturar os dois debaixo de "Explorar" escondia o Feed
 * atrás de mais um toque.
 *
 * Tradução (1º lote) — `label` guarda uma CHAVE de `translations.ts`
 * (ex.: "nav.series"), não o texto fixo em português — quem renderiza
 * (`BottomNavigation.tsx`) resolve com `t(tab.label)`.
 */
/*
 * DECISÃO DE PRODUTO (a pedido, com base em dado real do painel de
 * observabilidade) — a aba Feed foi descontinuada. Os números que
 * levaram a isso: 20 follows no total entre 383 usuários, 3 posts em
 * 7 dias, e posts/comentários por usuário ativo arredondando pra 0,0.
 * Sem grafo social, o Feed é estruturalmente uma tela vazia — não é
 * falta de divulgação, é que não há de quem seguir nem o que ver. Era
 * também a maior fonte de bug do app (crash em produção, Realtime
 * quebrado, botão de salvar sem tela).
 *
 * REVERSÍVEL DE PROPÓSITO: a rota `/feed` e todo o código continuam
 * existindo — só saiu da navegação. Voltar é reinserir esta linha.
 * O social que FUNCIONA continua intocado: avaliações com texto
 * (1.324 delas, nota média 4,27), comentários em episódio, recomendar
 * pra alguém, seguir pessoas e perfil público.
 */
export const tabs: Tab[] = [
  { href: "/series", label: "nav.series", icon: Tv },
  { href: "/movies", label: "nav.movies", icon: Clapperboard },
  { href: "/explore", label: "nav.explore", icon: Compass },
  { href: "/profile", label: "nav.profile", icon: User },
];
