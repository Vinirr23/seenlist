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
 */
export const tabs: Tab[] = [
  { href: "/series", label: "Séries", icon: Tv },
  { href: "/movies", label: "Filmes", icon: Clapperboard },
  { href: "/explore", label: "Explorar", icon: Compass },
  { href: "/profile", label: "Perfil", icon: User },
];
