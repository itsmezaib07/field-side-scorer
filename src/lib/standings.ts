import type { Tables } from "@/integrations/supabase/types";

type Match = Tables<"matches">;

export interface StandingRow {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export function computeStandings(matches: Match[], teamIds: string[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const id of teamIds) {
    map.set(id, { team_id: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  }
  for (const m of matches) {
    if (m.status !== "finished") continue;
    const h = map.get(m.home_team_id);
    const a = map.get(m.away_team_id);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  for (const r of map.values()) r.gd = r.gf - r.ga;
  return [...map.values()].sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf);
}