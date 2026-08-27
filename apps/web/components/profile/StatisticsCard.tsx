"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Tv2, Clapperboard, Clock3, Film } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { formatWatchDuration } from "@/lib/format-duration";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-054 — substitui ProfileStatsGrid (removido) e o carrossel
 * StatsCarousel no Perfil (o componente continua existindo, só que
 * agora só é usado dentro da própria tela de estatísticas). Um card
 * só, clicável, prévia de 4 números — leva pra /profile/stats. Mesmo
 * hook de sempre (useProfileStats), nenhum cálculo novo.
 *
 * "Vidro iluminado" (mockup-perfil-atual-vidro, 2026-08-21) — o card
 * virou vidro de verdade: fundo translúcido + `backdrop-blur` (antes
 * era um gradiente quase opaco, sem transparência real nenhuma).
 * Ganhou a mancha de luz concentrada num canto (branca) + um reflexo
 * azulado no canto oposto, e o "Ver detalhes" virou pílula "gel"
 * translúcida em vez de pílula sólida.
 */
export function StatisticsCard() {
  const { data: stats, isLoading, isError } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US");

  if (isLoading) {
    return <div className="mb-6 h-40 animate-pulse rounded-2xl bg-surface" />;
  }
  if (isError || !stats) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t("stats.loadError")}</p>
      </div>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes, t);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes, t);

  const preview = [
    { label: t("stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched), icon: Tv2 },
    { label: t("stats.moviesWatched"), value: numberFormatter.format(stats.moviesCompleted), icon: Film },
    { label: t("stats.seriesTime"), value: seriesTime.primary, icon: Clock3 },
    { label: t("stats.movieTime"), value: movieTime.primary, icon: Clapperboard },
  ];

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 p-4 backdrop-blur-[22px] backdrop-saturate-[180%]"
      style={{
        background:
          "radial-gradient(55% 65% at 14% 10%, rgba(255,255,255,0.17), transparent 55%), radial-gradient(50% 55% at 92% 100%, rgba(42,127,184,0.18), transparent 60%), rgba(255,255,255,0.09)",
        boxShadow:
          "0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.15)",
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-text">{t("stats.title")}</h2>
        </div>
        {/*
         * Correção (a pedido — "deixe 'ver detalhes' preto e
         * maiúsculo") — texto passou de `text-text` (creme) pra preto
         * (`text-background`, o mesmo tom escuro usado em botões
         * sólidos âmbar no resto do app — ex.: os pills de "Ver todas"
         * de DiscoverCarousel.tsx — pra contraste ficar bom sobre o
         * gradiente âmbar claro) + `uppercase font-bold` (era
         * `font-normal`, minúsculo). Este botão virou o "padrão" pra
         * todo botão do app — ver histórico no doc de sessão.
         */}
        <Link
          href="/profile/stats"
          className="flex items-center gap-1 rounded-full border border-white/15 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-background backdrop-blur-[10px] backdrop-saturate-[160%]"
          style={{
            background:
              "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
            // Correção (a pedido — "tira o brilho que tem por trás de
            // todos eles, inclusive no 'ver detalhes'") — removido o
            // halo âmbar (as duas sombras externas, coloridas e bem
            // desfocadas, que vazavam por trás do botão). Mantidas só
            // as sombras internas (o "gel"/relevo da própria pílula).
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
          }}
        >
          {t("stats.seeDetails")}
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {preview.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <item.icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-text">{item.value}</p>
              <p className="truncate text-xs text-muted">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
