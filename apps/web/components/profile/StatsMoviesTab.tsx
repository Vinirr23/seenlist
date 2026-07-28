"use client";

import { useProfileStats } from "@/lib/queries/profile-stats";
import { useSocialCounts } from "@/lib/queries/social-counts";
import { formatWatchDuration } from "@/lib/format-duration";
import { BigStatCard } from "./BigStatCard";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/**
 * TASK-054 — auditoria: moviesCompleted, movieWatchMinutes,
 * moviesInLibrary → já existiam em useProfileStats. Curtidas/
 * comentários/avaliações de filme não são separáveis das de série no
 * agregado atual de useSocialCounts (comments/reviews/likes cobrem
 * as duas mídias juntas na mesma tabela) — reaproveitado igual na
 * aba Séries, não duplicado aqui como se fosse outro número.
 *
 * NÃO implementado: "filmes restantes" não existe como conceito —
 * diferente de série, filme não tem "episódios restantes" (é
 * assistido ou não, sem progresso parcial no dado atual). "Gêneros
 * favoritos" tem a mesma limitação já documentada na aba Séries
 * (exigiria detalhe completo por filme no TMDB).
 */
export function StatsMoviesTab() {
  const { data: stats, isLoading } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading || !stats) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const watchTime = formatWatchDuration(stats.movieWatchMinutes, t);

  return (
    <div className="space-y-3 pb-4">
      <BigStatCard title={t("profile.stats.timeWatchingMoviesFull")} value={watchTime.primary} subtext={watchTime.secondary} />

      <div className="grid grid-cols-2 gap-3">
        <BigStatCard title={t("profile.stats.moviesWatched")} value={numberFormatter.format(stats.moviesCompleted)} />
        <BigStatCard title={t("profile.stats.moviesInLibrary")} value={numberFormatter.format(stats.moviesInLibrary)} />
      </div>
    </div>
  );
}
