import { Tv, Clapperboard, Rss, Compass, User, type LucideIcon } from "lucide-react";

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
export const tabs: Tab[] = [
  { href: "/series", label: "nav.series", icon: Tv },
  { href: "/movies", label: "nav.movies", icon: Clapperboard },
  { href: "/feed", label: "nav.feed", icon: Rss },
  { href: "/explore", label: "nav.explore", icon: Compass },
  { href: "/profile", label: "nav.profile", icon: User },
];
