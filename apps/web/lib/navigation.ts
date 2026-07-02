import { Tv, Clapperboard, Library, User, type LucideIcon } from "lucide-react";

export type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * TASK-007 pede "Séries, Filmes, Minha Lista, Perfil" — Explorar
 * sai da barra. A Pesquisa em si (NÃO ALTERAR) continua existindo em
 * /explore, só perde o atalho na navegação; ainda é alcançável
 * digitando a URL, mas nenhuma tela linka pra lá mais.
 */
export const tabs: Tab[] = [
  { href: "/series", label: "Séries", icon: Tv },
  { href: "/movies", label: "Filmes", icon: Clapperboard },
  { href: "/library", label: "Minha Lista", icon: Library },
  { href: "/profile", label: "Perfil", icon: User },
];
