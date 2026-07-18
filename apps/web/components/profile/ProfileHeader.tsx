"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import type { CurrentUser } from "@/lib/queries/current-user";
import { useMyProfile } from "@/lib/queries/my-profile";
import { useFollowCounts } from "@/lib/queries/public-profile";
import { useSocialCounts } from "@/lib/queries/social-counts";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { ShareProfileButton } from "@/components/social/ShareProfileButton";

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
 * TASK-028 — ganhou username (@handle), banner, e os 3 contadores
 * (item 4 — "comentários" fica em 0 fixo, como a própria tarefa
 * autoriza: "podem permanecer zerados por enquanto", já que não
 * existe feature de comentário nenhuma ainda). Botão "Compartilhar
 * perfil" reaproveitado do componente já usado no perfil público.
 *
 * Tradução (4º lote) — inclui o formatador de data ("Membro desde"),
 * que antes ficava fixo em pt-BR mesmo com o idioma trocado.
 */
export function ProfileHeader({ user }: { user: CurrentUser }) {
  const { data: profile } = useMyProfile();
  const { data: counts } = useFollowCounts(user.id);
  const { data: socialCounts } = useSocialCounts();
  const { t, locale } = useTranslation();
  const joinDateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: "long", year: "numeric" });
  const joinDate = joinDateFormatter.format(new Date(user.createdAt));

  return (
    <div className={profile?.bannerUrl ? "mb-6" : "mb-6 -mx-4 -mt-4 px-4 pt-4 pb-2 bg-gradient-to-b from-primary/[0.09] via-transparent to-transparent sm:rounded-t-lg"}>
      {profile?.bannerUrl && (
        <div className="relative -mx-4 h-32 w-[calc(100%+2rem)] overflow-hidden bg-surface shadow-lg shadow-black/30 sm:rounded-b-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image */}
          <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
          <div className="absolute right-3 top-3 flex gap-2">
            {profile?.username && <ShareProfileButton username={profile.username} iconOnly />}
            <Link
              href="/profile/settings"
              aria-label="Configurações"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <Settings className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
      )}

      {!profile?.bannerUrl && (
        <div className="flex justify-end gap-2 pb-2">
          {profile?.username && <ShareProfileButton username={profile.username} iconOnly />}
          <Link
            href="/profile/settings"
            aria-label="Configurações"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-text"
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}

      <div className={profile?.bannerUrl ? "-mt-8 flex items-end gap-4" : "flex items-center gap-4"}>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ring-2 ring-primary/50 ring-offset-2 ring-offset-background">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo, sem domínio fixo pra configurar em next/image
            <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-semibold text-muted">{initials(user.name)}</span>
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-text">{user.name}</p>
          {profile?.username && <p className="truncate text-sm text-primary">@{profile.username}</p>}
          <p className="text-xs text-muted">{t("profile.memberSince", { date: joinDate })}</p>
        </div>
      </div>

      {profile?.bio && <p className="mt-3 text-sm text-text">{profile.bio}</p>}

      <div className="mt-4 flex gap-6">
        <Link href="/profile/following" className="transition-opacity active:opacity-70">
          <p className="text-sm font-bold text-text">{counts?.following ?? 0}</p>
          <p className="text-xs text-muted">{t("profile.following")}</p>
        </Link>
        <Link href="/profile/followers" className="transition-opacity active:opacity-70">
          <p className="text-sm font-bold text-text">{counts?.followers ?? 0}</p>
          <p className="text-xs text-muted">{t("profile.followers")}</p>
        </Link>
        <Link href="/profile/comments" className="transition-opacity active:opacity-70">
          <p className="text-sm font-bold text-text">{socialCounts?.commentsGiven ?? 0}</p>
          <p className="text-xs text-muted">{t("profile.comments")}</p>
        </Link>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href="/profile/edit"
          className="inline-flex items-center justify-center rounded-lg border border-primary bg-transparent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary transition-transform active:scale-[0.96]"
        >
          {t("profile.edit")}
        </Link>
      </div>
    </div>
  );
}
