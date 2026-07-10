import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface WeekBucket {
  /** Segunda-feira da semana, formato yyyy-mm-dd — só pra ordenar/rotular. */
  weekStart: string;
  count: number;
}

export interface EpisodesTimeline {
  /** Últimas 12 semanas, mais antiga primeiro — pro gráfico de barras. */
  weeks: WeekBucket[];
  /** Média de episódios/semana nas últimas 12 semanas (só as que já têm dado — não conta semanas futuras). */
  averagePerWeek: number;
  /** Maior quantidade de episódios assistidos num único dia — "maior maratona". */
  biggestBingeDay: { date: string; count: number } | null;
}

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // domingo (0) volta 6 dias, resto volta até a segunda
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * TASK-054 — dado real que já existe (`watched_episodes.watched_at`,
 * gravado desde a TASK original de marcar episódio), só nunca tinha
 * sido agregado por semana/dia antes. Sem tabela nova, sem migration
 * — só uma consulta a mais, escopada nas últimas ~90 dias pra não
 * puxar o histórico inteiro de quem importou milhares de episódios
 * do TV Time de uma vez.
 */
export function useEpisodesTimeline() {
  return useQuery({
    queryKey: ["episodes-timeline"],
    queryFn: async (): Promise<EpisodesTimeline> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data, error } = await supabase
        .from("watched_episodes")
        .select("watched_at")
        .eq("user_id", user.id)
        .gte("watched_at", since.toISOString());

      if (error) {
        console.error("[episodes-timeline] Falha ao buscar histórico", describeSupabaseError(error));
        throw error;
      }

      const byWeek = new Map<string, number>();
      const byDay = new Map<string, number>();

      for (const row of data ?? []) {
        const date = new Date(row.watched_at);
        const day = date.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
        const week = mondayOf(date);
        byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
      }

      // Últimas 12 semanas, incluindo as sem nenhum episódio (0) — pra o gráfico não pular buraco.
      const weeks: WeekBucket[] = [];
      const cursor = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(cursor);
        d.setDate(d.getDate() - i * 7);
        const weekStart = mondayOf(d);
        if (!weeks.some((w) => w.weekStart === weekStart)) {
          weeks.push({ weekStart, count: byWeek.get(weekStart) ?? 0 });
        }
      }

      const nonZeroWeeks = weeks.filter((w) => w.count > 0);
      const averagePerWeek =
        nonZeroWeeks.length > 0 ? weeks.reduce((sum, w) => sum + w.count, 0) / weeks.length : 0;

      let biggestBingeDay: EpisodesTimeline["biggestBingeDay"] = null;
      for (const [date, count] of byDay.entries()) {
        if (!biggestBingeDay || count > biggestBingeDay.count) {
          biggestBingeDay = { date, count };
        }
      }

      return { weeks, averagePerWeek, biggestBingeDay };
    },
  });
}
