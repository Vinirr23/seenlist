import { supabase } from "@/lib/supabase";

export interface WeekBucket {
  weekStart: string;
  count: number;
}

export interface EpisodesTimeline {
  weeks: WeekBucket[];
  averagePerWeek: number;
  biggestBingeDay: { date: string; count: number } | null;
}

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** Idêntico a episodes-timeline.ts do web — dado real (watched_episodes.watched_at), agregado por semana/dia, escopado nos últimos 90 dias. */
export async function fetchEpisodesTimeline(): Promise<EpisodesTimeline> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { weeks: [], averagePerWeek: 0, biggestBingeDay: null };

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase.from("watched_episodes").select("watched_at").eq("user_id", user.id).gte("watched_at", since.toISOString());
  if (error) throw error;

  const byWeek = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const row of data ?? []) {
    const date = new Date(row.watched_at);
    const day = date.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const week = mondayOf(date);
    byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
  }

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
  const averagePerWeek = nonZeroWeeks.length > 0 ? weeks.reduce((sum, w) => sum + w.count, 0) / weeks.length : 0;

  let biggestBingeDay: EpisodesTimeline["biggestBingeDay"] = null;
  for (const [date, count] of byDay.entries()) {
    if (!biggestBingeDay || count > biggestBingeDay.count) biggestBingeDay = { date, count };
  }

  return { weeks, averagePerWeek, biggestBingeDay };
}
