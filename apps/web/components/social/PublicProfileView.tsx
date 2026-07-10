"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useCurrentUser } from "@/lib/queries/current-user";
import { usePublicProfile, useFollowCounts } from "@/lib/queries/public-profile";
import { usePublicStats } from "@/lib/queries/public-stats";
import { FollowButton } from "./FollowButton";
import { ShareProfileButton } from "./ShareProfileButton";
import { PublicLibrarySection } from "./PublicLibrarySection";
import { PublicFavoritesSection } from "./PublicFavoritesSection";
import { StatsCarousel } from "@/components/profile/StatsCarousel";

const joinDateFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((word) => word.length > 1)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-028 — página pública em `/u/[username]`. Item 11: só o
 * cabeçalho (via `usePublicProfile`, uma linha só da tabela
 * `profiles`) carrega de imediato; biblioteca e favoritos são
 * componentes à parte que só buscam quando realmente renderizam
 * (React Query lazy por natureza — não precisou de nenhuma técnica
 * especial de lazy-loading além de "não chamar o hook mais cedo").
 *
 * Não sabemos o nome/avatar de quem é dono do perfil sem outra
 * fonte — `profiles` não guarda nome nem foto (isso mora em
 * `auth.users`, que não é publicamente consultável por design do
 * Supabase). Por isso o cabeçalho usa o username como identificação
 * principal; nome/foto completos só aparecem quando é o PRÓPRIO
 * usuário vendo a própria página pública (via `useCurrentUser`).
 */
export function PublicProfileView({ username }: { username: string }) {
  const { data: profile, isLoading, isError } = usePublicProfile(username);
  const { data: currentUser } = useCurrentUser();
  const { data: counts } = useFollowCounts(profile?.userId ?? null);
  const statsQuery = usePublicStats(profile?.userId ?? null);

  if (isLoading) {
    return (
      <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
        <div className="h-28 animate-pulse rounded-lg bg-surface" />
        <div className="mt-4 h-6 w-40 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">Não foi possível carregar este perfil agora. Tente de novo.</p>
      </div>
    );
  }

  // `null` cobre tanto "não existe" quanto "existe mas é privado" de
  // propósito — a RLS já filtra isso, e não queremos revelar qual
  // dos dois casos é (ver comentário em usePublicProfile).
  if (!profile) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === profile.userId;
  // Correção de investigação — antes, só o dono via o nome/avatar de
  // verdade, porque a única fonte existente (user_metadata) nunca foi
  // pública via RLS. Agora que profiles.display_name/avatar_url
  // existem e SÃO lidos com a mesma policy de visibilidade da própria
  // página, qualquer pessoa autorizada a ver o perfil vê o nome/foto
  // reais — não só o username.
  const displayName = profile.displayName?.trim() || `@${profile.username}`;
  const avatarUrl = profile.avatarUrl;

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="relative mb-14 h-28 w-full bg-surface">
        {profile.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image
          <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute -bottom-10 left-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-surface">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-semibold text-muted">{initials(displayName)}</span>
          )}
        </div>
      </div>

      <div className="px-4">
        <p className="text-lg font-bold text-text">{displayName}</p>
        <p className="text-sm text-primary">@{profile.username}</p>
        {profile.bio && <p className="mt-2 text-sm text-text">{profile.bio}</p>}
        <p className="mt-1 text-xs text-muted">
          {[profile.country, `Entrou em ${joinDateFormatter.format(new Date(profile.createdAt))}`]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-sm font-bold text-text">{counts?.following ?? 0}</p>
            <p className="text-xs text-muted">Seguindo</p>
          </div>
          <div>
            <p className="text-sm font-bold text-text">{counts?.followers ?? 0}</p>
            <p className="text-xs text-muted">Seguidores</p>
          </div>
          <div>
            <p className="text-sm font-bold text-text">0</p>
            <p className="text-xs text-muted">Comentários</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {isOwnProfile ? (
            <Link
              href="/profile/edit"
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition-transform active:scale-[0.96]"
            >
              Editar
            </Link>
          ) : (
            <FollowButton targetUserId={profile.userId} />
          )}
          <ShareProfileButton username={profile.username} />
        </div>

        <div className="mt-8">
          <StatsCarousel
            stats={statsQuery.data}
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            ownerLabel={isOwnProfile ? "own" : "other"}
          />
        </div>

        <div className="mt-6">
          <PublicFavoritesSection userId={profile.userId} />
        </div>

        <div className="mt-6">
          <PublicLibrarySection userId={profile.userId} />
        </div>
      </div>
    </div>
  );
}
