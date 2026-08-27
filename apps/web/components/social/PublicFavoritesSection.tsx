"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import { usePublicFavorites } from "@/lib/queries/favorites";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PublicMediaCarousel } from "./PublicMediaCarousel";

/**
 * SEM USO a partir de 2026-08-26 (correção seguinte, mesmo dia): a
 * ordem em que este componente era chamado ANTES de
 * `PublicLibrarySection` em `PublicProfileView.tsx` dava a sequência
 * errada Séries favoritas → Filmes favoritos → Séries → Filmes (o
 * usuário reportou: "a sequencia ... não está igual ao perfil
 * usuário"). `PublicProfileView.tsx` agora chama
 * `PublicMediaSectionsList.tsx` (junta biblioteca + favoritos num
 * componente só, na ordem certa: Séries → Séries favoritas → Filmes →
 * Filmes favoritos). Este arquivo fica aqui sem uso, não apagado
 * (mesmo padrão já usado com `FavoriteCard.tsx` na correção
 * anterior) — dá pra apagar com segurança quando confirmado que nada
 * mais importa dele.
 *
 * Comentário original (Reorganização, perfil público, a pedido,
 * 2026-08-26 — correção do entendimento anterior: "é pra ter
 * carrossel e ter sub páginas, igual ao perfil do usuário"). "Séries
 * favoritas" e "Filmes favoritos" viram carrosséis horizontais (mesmo
 * padrão de `ProfileMediaCarousel.tsx` no Perfil próprio, via
 * `PublicMediaCarousel.tsx`), cada um com um link "ver mais" que leva
 * pra uma sub-página com a lista completa (`/u/[username]/favorite-series`,
 * `/u/[username]/favorite-movies`) — antes disto, era um card de
 * vidro único mostrando tudo direto na própria página (correção de
 * uma primeira tentativa que não bateu com o pedido real).
 */
export function PublicFavoritesSection({ userId, username }: { userId: string; username: string }) {
  const { data: items, isLoading } = usePublicFavorites(userId);
  const { t } = useTranslation();

  const favoriteSeries = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);
  const favoriteMovies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);

  return (
    <div>
      <PublicMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteSeries")}
        href={`/u/${username}/favorite-series`}
        items={favoriteSeries}
        isLoading={isLoading}
      />
      <PublicMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteMovies")}
        href={`/u/${username}/favorite-movies`}
        items={favoriteMovies}
        isLoading={isLoading}
      />
    </div>
  );
}
