"use client";

import { ListChecks, Tv, Star, Clapperboard } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useProfileSectionCounts } from "@/lib/queries/profile-section-counts";
import { ProfileSectionRow } from "./ProfileSectionRow";

/**
 * TASK-029 — substitui `ProfileSeriesSection`/`ProfileMoviesSection`
 * renderizadas direto na tela. Só os contadores são buscados aqui
 * (`useProfileSectionCounts` — 5 consultas `head: true`, nunca o
 * conteúdo completo); cada seção busca o próprio conteúdo somente
 * quando o usuário abre a página dela.
 */
export function ProfileSectionsList() {
  const { data: user } = useCurrentUser();
  const { data: counts } = useProfileSectionCounts(user?.id ?? null);

  return (
    <section className="mb-6 space-y-2">
      <ProfileSectionRow icon={ListChecks} label="Minhas listas" count={counts?.lists} href="/profile/lists" />
      <ProfileSectionRow icon={Tv} label="Séries" count={counts?.series} href="/profile/series" />
      <ProfileSectionRow
        icon={Star}
        label="Séries favoritas"
        count={counts?.favoriteSeries}
        href="/profile/favorite-series"
      />
      <ProfileSectionRow icon={Clapperboard} label="Filmes" count={counts?.movies} href="/profile/movies" />
      <ProfileSectionRow
        icon={Star}
        label="Filmes favoritos"
        count={counts?.favoriteMovies}
        href="/profile/favorite-movies"
      />
    </section>
  );
}
