"use client";

import { useMemo } from "react";
import { Tv, Clapperboard } from "lucide-react";
import { usePublicLibraryItems } from "@/lib/queries/public-library";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PageError } from "@/components/media/PageError";
import { PublicMediaCarousel } from "./PublicMediaCarousel";

/**
 * SEM USO a partir de 2026-08-26 (correção seguinte, mesmo dia): a
 * ordem em que este componente era chamado DEPOIS de
 * `PublicFavoritesSection` em `PublicProfileView.tsx` dava a
 * sequência errada Séries favoritas → Filmes favoritos → Séries →
 * Filmes (o usuário reportou: "a sequencia ... não está igual ao
 * perfil usuário"). `PublicProfileView.tsx` agora chama
 * `PublicMediaSectionsList.tsx` (junta biblioteca + favoritos num
 * componente só, na ordem certa: Séries → Séries favoritas → Filmes →
 * Filmes favoritos, incluindo a mesma regra "só filme Assistido" —
 * ver comentário original abaixo). Este arquivo fica aqui sem uso,
 * não apagado (mesmo padrão já usado com `FavoriteCard.tsx` na
 * correção anterior) — dá pra apagar com segurança quando confirmado
 * que nada mais importa dele.
 *
 * Comentário original:
 * TASK-028, item 6 — filme conta só "Assistidos" (status
 * `completed`), decisão deliberada e mais simples que o Filmes
 * pessoal (que tem várias categorias) — mantida aqui mesmo depois da
 * reorganização de 2026-08-26, já que o pedido do usuário foi sobre
 * ESTRUTURA (carrossel + sub-página), não sobre mostrar pra
 * visitantes filmes que a pessoa só marcou "assistir depois".
 *
 * Item 11: este componente só existe (e só busca dado) quando o
 * perfil público realmente renderiza a seção de biblioteca — as
 * informações básicas do cabeçalho (nome, username, bio) vêm de uma
 * query separada e mais leve (`usePublicProfile`), carregada antes.
 *
 * Reorganização (perfil público, a pedido, 2026-08-26 — correção do
 * entendimento anterior: "é pra ter carrossel e ter sub páginas,
 * igual ao perfil do usuário"). "Séries" e "Filmes" viram carrosséis
 * horizontais (mesmo padrão de `ProfileMediaCarousel.tsx` no Perfil
 * próprio, via `PublicMediaCarousel.tsx`, sem separar por categoria
 * de status aqui — isso só aparece na sub-página, igual ao Perfil
 * próprio), cada um com um link "ver mais" levando pra
 * `/u/[username]/series` / `/u/[username]/movies` (lista completa,
 * COM a separação por categoria — ver `PublicSeriesPageView.tsx`).
 * Substitui uma primeira tentativa (card de vidro único mostrando
 * tudo direto, categorizado, na própria página) que não bateu com o
 * pedido real.
 */
export function PublicLibrarySection({ userId, username }: { userId: string; username: string }) {
  const { data: items, isLoading, isError, refetch } = usePublicLibraryItems(userId);
  const { t } = useTranslation();

  const series = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "series").sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [items]
  );
  const watchedMovies = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.mediaType === "movie" && item.status === "completed")
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    [items]
  );

  if (isError) {
    return <PageError message={t("social.errorLoadPublicLibrary")} onRetry={() => refetch()} />;
  }

  return (
    <div>
      <PublicMediaCarousel
        icon={Tv}
        label={t("nav.series")}
        href={`/u/${username}/series`}
        items={series}
        isLoading={isLoading}
      />
      <PublicMediaCarousel
        icon={Clapperboard}
        label={t("nav.movies")}
        href={`/u/${username}/movies`}
        items={watchedMovies}
        isLoading={isLoading}
      />
    </div>
  );
}
