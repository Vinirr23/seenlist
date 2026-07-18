"use client";

import { ListChecks, Tv, Star, Clapperboard, Send } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useProfileSectionCounts } from "@/lib/queries/profile-section-counts";
import { useUnreadRecommendationsCount } from "@/lib/queries/recommendations";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ProfileSectionRow } from "./ProfileSectionRow";

/**
 * TASK-029 — substitui `ProfileSeriesSection`/`ProfileMoviesSection`
 * renderizadas direto na tela. Só os contadores são buscados aqui
 * (`useProfileSectionCounts` — 5 consultas `head: true`, nunca o
 * conteúdo completo); cada seção busca o próprio conteúdo somente
 * quando o usuário abre a página dela.
 *
 * Tradução (4º lote) — "Séries"/"Filmes" reaproveitam as mesmas
 * chaves da barra de navegação (`nav.series`/`nav.movies`), mesmo
 * texto em todo lugar do app.
 */
export function ProfileSectionsList() {
  const { data: user } = useCurrentUser();
  const { data: counts } = useProfileSectionCounts(user?.id ?? null);
  const { data: unreadRecommendations } = useUnreadRecommendationsCount();
  const { t } = useTranslation();

  return (
    <section className="mb-6 space-y-2">
      <ProfileSectionRow
        icon={Send}
        label="Recomendações"
        count={unreadRecommendations}
        href="/profile/recommendations"
      />
      <ProfileSectionRow icon={ListChecks} label={t("profile.section.lists")} count={counts?.lists} href="/profile/lists" />
      <ProfileSectionRow icon={Tv} label={t("nav.series")} count={counts?.series} href="/profile/series" />
      <ProfileSectionRow
        icon={Star}
        label={t("profile.section.favoriteSeries")}
        count={counts?.favoriteSeries}
        href="/profile/favorite-series"
      />
      <ProfileSectionRow icon={Clapperboard} label={t("nav.movies")} count={counts?.movies} href="/profile/movies" />
      <ProfileSectionRow
        icon={Star}
        label={t("profile.section.favoriteMovies")}
        count={counts?.favoriteMovies}
        href="/profile/favorite-movies"
      />
    </section>
  );
}
