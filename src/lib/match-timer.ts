import type { Tables } from "@/integrations/supabase/types";

type Match = Tables<"matches">;

export function getElapsedSeconds(match: Pick<Match, "accumulated_seconds" | "timer_started_at" | "status">, now = Date.now()): number {
  const acc = match.accumulated_seconds ?? 0;
  if (match.timer_started_at && (match.status === "first_half" || match.status === "second_half")) {
    const started = new Date(match.timer_started_at).getTime();
    return acc + Math.max(0, Math.floor((now - started) / 1000));
  }
  return acc;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}'${s.toString().padStart(2, "0")}`;
}

export function getMinute(seconds: number): number {
  return Math.max(1, Math.floor(seconds / 60) + (seconds % 60 > 0 ? 1 : 0));
}