import { Tv, Clapperboard, Compass, User, type LucideIcon } from "lucide-react";

export type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const tabs: Tab[] = [
  { href: "/series", label: "Séries", icon: Tv },
  { href: "/movies", label: "Filmes", icon: Clapperboard },
  { href: "/explore", label: "Explorar", icon: Compass },
  { href: "/profile", label: "Perfil", icon: User },
];
