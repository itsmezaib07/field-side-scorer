import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlatformOwner } from "@/lib/use-platform-owner";
import { useEffect, useRef, useState } from "react";
import { formatClock, getElapsedSeconds, getMinute } from "@/lib/match-timer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Play, Pause, Square, Flag, Goal as GoalIcon, RectangleVertical, ArrowLeftRight, Trash2 } from "lucide-react";

export const Route = createFileRoute("/matches/$matchId")({
  component: MatchView,
});

type Match = any;
type Player = { id: string; name: string; jersey_number: number | null; team_id: string };

function MatchView() {
  const { matchId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tick, setTick] = useState(0);

  const { data: match } = useQuery<Match>({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, home_team:teams!matches_home_team_id_fkey(id,name,logo_url), away_team:teams!matches_away_team_id_fkey(id,name,logo_url), tournament:tournaments(id, name, creator_id)")
        .eq("id", matchId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["events", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events")
        .select("*, player:players!match_events_player_id_fkey(name, jersey_number), assist:players!match_events_assist_player_id_fkey(name), sub_in:players!match_events_sub_in_player_id_fkey(name, jersey_number), card_player:players!match_events_card_player_id_fkey(name, jersey_number)")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: scorers } = useQuery({
    queryKey: ["scorers", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_scorers").select("user_id").eq("match_id", matchId);
      if (error) throw error;
      return data;
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`match-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => qc.invalidateQueries({ queryKey: ["match", matchId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` }, () => qc.invalidateQueries({ queryKey: ["events", matchId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  // Tick clock
  useEffect(() => {
    const i = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(i);
  }, []);

  if (!match) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const isAdmin = user?.id === match.tournament?.creator_id;
  const isScorer = isAdmin || (scorers ?? []).some((s) => s.user_id === user?.id);
  const elapsed = getElapsedSeconds(match);
  void tick;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/90 text-primary-foreground p-4">
        <div className="text-center text-xs uppercase opacity-80">{match.tournament?.name}</div>
        <div className="grid grid-cols-3 items-center mt-2">
          <TeamBlock team={match.home_team} />
          <div className="text-center">
            <div className="text-4xl font-bold tabular-nums">{match.home_score} - {match.away_score}</div>
            <div className="mt-1 font-mono text-sm">{formatClock(elapsed)}</div>
            <div className="text-[10px] uppercase opacity-80">{statusLabel(match.status)}</div>
          </div>
          <TeamBlock team={match.away_team} />
        </div>
        <div className="mt-2 text-center text-[10px] uppercase opacity-80">
          Match Duration: {Array.from({ length: match.number_of_halves ?? 2 }).map(() => match.minutes_per_half ?? 45).join(" + ")} Minutes
          {match.extra_time_minutes_per_half ? ` (+${match.extra_time_minutes_per_half} extra/half)` : ""}
        </div>
      </div>

      {isScorer && <ScoringPanel match={match} elapsed={elapsed} events={events ?? []} />}
      {isAdmin && <AdminPanel match={match} />}

      {match.status === "finished" && <MatchSummary match={match} />}

      <section>
        <h2 className="font-semibold mb-2">Timeline</h2>
        {events && events.length > 0 ? (
          <ul className="space-y-2">
            {events.map((e: any) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
                <div className="w-8 text-center font-mono text-xs text-muted-foreground">{e.minute ? `${e.minute}'` : "—"}</div>
                <div className="flex-1">{eventLabel(e, match)}</div>
                {isScorer && (
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this event?")) return;
                      // If goal, decrement score
                      if (e.type === "goal") {
                        if (e.team_id === match.home_team_id) {
                          await supabase.from("matches").update({ home_score: Math.max(0, match.home_score - 1) }).eq("id", matchId);
                        } else if (e.team_id === match.away_team_id) {
                          await supabase.from("matches").update({ away_score: Math.max(0, match.away_score - 1) }).eq("id", matchId);
                        }
                      }
                      const { error } = await supabase.from("match_events").delete().eq("id", e.id);
                      if (error) return toast.error(error.message);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        )}
      </section>
    </div>
  );
}

function TeamBlock({ team }: { team: any }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {team?.logo_url ? (
        <img src={team.logo_url} alt={team.name} className="h-12 w-12 rounded-full object-cover bg-background" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-background/20" />
      )}
      <div className="text-xs font-semibold text-center line-clamp-2">{team?.name}</div>
    </div>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case "scheduled": return "Not started";
    case "first_half": return "1st half";
    case "halftime": return "Half time";
    case "second_half": return "2nd half";
    case "paused": return "Paused";
    case "finished": return "Full time";
    default: return s;
  }
}

function eventLabel(e: any, match: any) {
  const team = e.team_id === match.home_team_id ? match.home_team?.name : e.team_id === match.away_team_id ? match.away_team?.name : "";
  switch (e.type) {
    case "goal":
      return <span>⚽ <b>Goal</b> · {team} — {e.player?.name ?? "?"}{e.assist ? <span className="text-muted-foreground"> (assist: {e.assist.name})</span> : null}</span>;
    case "yellow_card":
      return <span>🟨 Yellow · {team} — {e.player?.name ?? "?"}</span>;
    case "red_card":
      return <span>🟥 Red · {team} — {e.player?.name ?? "?"}</span>;
    case "substitution":
      return <span>🔁 Sub · {team} — {e.sub_in?.name ?? "?"} ⇆ {e.player?.name ?? "?"}</span>;
    case "foul": {
      const card =
        e.card_type === "yellow" ? <> + <span className="inline-flex items-center gap-1 text-yellow-600"><RectangleVertical className="h-3.5 w-3.5 fill-yellow-500 text-yellow-600" />Yellow</span>{e.card_player && e.card_player.name !== e.player?.name ? ` (${e.card_player.name})` : ""}</>
        : e.card_type === "red" ? <> + <span className="inline-flex items-center gap-1 text-red-600"><RectangleVertical className="h-3.5 w-3.5 fill-red-500 text-red-600" />Red</span>{e.card_player && e.card_player.name !== e.player?.name ? ` (${e.card_player.name})` : ""}</>
        : null;
      const outcome = foulOutcomeLabel(e.foul_outcome);
      return <span className="inline-flex items-center gap-1 flex-wrap"><Flag className="h-4 w-4 text-muted-foreground" /><b>Foul</b> · {team} — {e.player?.name ?? "?"}{card}{outcome ? <> → {outcome}</> : null}</span>;
    }
    case "kickoff": return <span>▶ Kick off</span>;
    case "halftime": return <span>⏸ Half time</span>;
    case "second_half": return <span>▶ Second half</span>;
    case "fulltime": return <span>⏹ Full time</span>;
    case "pause": return <span>⏸ Paused</span>;
    case "resume": return <span>▶ Resumed</span>;
  }
}

function foulOutcomeLabel(o: string | null | undefined) {
  switch (o) {
    case "direct_free_kick": return "Direct Free Kick";
    case "indirect_free_kick": return "Indirect Free Kick";
    case "penalty": return "Penalty";
    case "advantage": return "Advantage Played";
    case "no_action": return "No Further Action";
    default: return null;
  }
}

function AdminPanel({ match }: { match: any }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const hasLiveData = ["first_half", "halftime", "second_half", "paused", "finished"].includes(match.status);

  const openDelete = () => {
    setConfirmStep(1);
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("matches").delete().eq("id", match.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Match deleted");
    setConfirmOpen(false);
    navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: match.tournament_id } });
  };

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground font-semibold">Admin</span>
        <button onClick={() => setOpen((x) => !x)} className="text-xs text-primary">{open ? "Hide" : "Manage scorers"}</button>
      </div>
      {open && <ScorersManager matchId={match.id} />}
      <div className="pt-2 border-t">
        <Button variant="destructive" size="sm" onClick={openDelete} className="w-full">
          <Trash2 className="h-4 w-4" /> Delete Match
        </Button>
      </div>
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!deleting) setConfirmOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Match?</DialogTitle>
          </DialogHeader>
          {confirmStep === 1 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete this match? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => { if (hasLiveData) setConfirmStep(2); else doDelete(); }}
                  disabled={deleting}
                >
                  Delete Match
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-destructive font-medium">
                This match contains live match data. Deleting it will permanently remove the score, timeline events, statistics, and match records.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
                <Button variant="destructive" onClick={doDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Permanently Delete"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScorersManager({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const { data } = useQuery({
    queryKey: ["scorers-full", matchId],
    queryFn: async () => {
      const { data: rows } = await supabase.from("match_scorers").select("user_id").eq("match_id", matchId);
      const ids = (rows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      return profs ?? [];
    },
  });
  const add = async () => {
    const { data: prof } = await supabase.from("profiles").select("id").ilike("display_name", email).maybeSingle();
    if (!prof) return toast.error("User not found by display name. Ask them to sign up first.");
    const { error } = await supabase.from("match_scorers").insert({ match_id: matchId, user_id: prof.id });
    if (error) return toast.error(error.message);
    setEmail("");
    qc.invalidateQueries({ queryKey: ["scorers-full", matchId] });
    qc.invalidateQueries({ queryKey: ["scorers", matchId] });
  };
  const remove = async (uid: string) => {
    await supabase.from("match_scorers").delete().eq("match_id", matchId).eq("user_id", uid);
    qc.invalidateQueries({ queryKey: ["scorers-full", matchId] });
    qc.invalidateQueries({ queryKey: ["scorers", matchId] });
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Scorer display name" className="flex-1 rounded-md border bg-background px-2 py-1 text-sm" />
        <Button size="sm" onClick={add}>Add</Button>
      </div>
      <ul className="text-sm space-y-1">
        {data?.map((p: any) => (
          <li key={p.id} className="flex justify-between items-center">
            <span>{p.display_name}</span>
            <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoringPanel({ match, elapsed, events }: { match: any; elapsed: number; events: any[] }) {
  const matchId = match.id;
  const minute = getMinute(elapsed);

  const baseMph = match.minutes_per_half ?? 45;
  // Configured durations (base, without stoppage)
  const firstHalfConfiguredSec = baseMph * 60;
  // For the 2nd half target, use the per-match override if set (chosen at half-time),
  // otherwise fall back to the configured base.
  const secondHalfConfiguredSec = (match.second_half_minutes ?? baseMph) * 60;

  // Effective hard limits (configured + admin-added stoppage)
  const firstHalfLimitSec = firstHalfConfiguredSec + (match.first_half_stoppage_seconds ?? 0);
  const firstActual = match.first_half_actual_seconds ?? 0;
  const secondHalfElapsed = Math.max(0, elapsed - firstActual);
  const secondHalfLimitSec = secondHalfConfiguredSec + (match.second_half_stoppage_seconds ?? 0);

  // Full-time becomes available once the second half has reached its configured target.
  const fullTimeReached = match.status === "second_half" && secondHalfElapsed >= secondHalfConfiguredSec;

  // Stoppage prompt: only AT or after configured duration of the current half.
  const inFirst = match.status === "first_half";
  const inSecond = match.status === "second_half";
  const currentHalfElapsed = inSecond ? secondHalfElapsed : elapsed;
  const currentHalfConfiguredSec = inSecond ? secondHalfConfiguredSec : firstHalfConfiguredSec;
  const currentHalfLimitSec = inSecond ? secondHalfLimitSec : firstHalfLimitSec;
  const showStoppage = (inFirst || inSecond) && currentHalfElapsed >= currentHalfConfiguredSec;

  // Smart suggestion: events in last 90s that often warrant stoppage
  const recentSuggestion = (() => {
    if (!showStoppage) return null;
    const now = Date.now();
    const recent = events.filter((e) => now - new Date(e.created_at).getTime() < 90_000);
    const reasons: string[] = [];
    if (recent.some((e) => e.type === "pause")) reasons.push("long pause");
    if (recent.some((e) => e.type === "substitution")) reasons.push("substitution");
    if (recent.some((e) => e.type === "foul" && e.card_type === "red")) reasons.push("red card");
    if (recent.some((e) => e.type === "foul" && e.foul_outcome === "penalty")) reasons.push("penalty");
    return reasons.length ? reasons.join(", ") : null;
  })();

  const [halftimePrompt, setHalftimePrompt] = useState(false);
  const autoEndedRef = useRef(false);

  const log = async (payload: any) => {
    const { error } = await supabase.from("match_events").insert({ match_id: matchId, minute, ...payload });
    if (error) toast.error(error.message);
  };

  const start = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("matches").update({
      status: "first_half",
      current_half: 1,
      timer_started_at: now,
      accumulated_seconds: 0,
      actual_started_at: now,
      started_by_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "kickoff" });
  };

  const halftime = async () => {
    const acc = getElapsedSeconds(match);
    // If ended before base first-half duration, ask about 2nd-half length first.
    if (acc < baseMph * 60) {
      setHalftimePrompt(true);
      return;
    }
    await finishFirstHalf(acc, match.second_half_minutes ?? baseMph);
  };

  const finishFirstHalf = async (acc: number, secondHalfMin: number) => {
    const { error } = await supabase.from("matches").update({
      status: "halftime",
      timer_started_at: null,
      accumulated_seconds: acc,
      first_half_actual_seconds: acc,
      second_half_minutes: secondHalfMin,
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "halftime" });
    setHalftimePrompt(false);
  };

  const secondHalf = async () => {
    const { error } = await supabase.from("matches").update({
      status: "second_half",
      current_half: 2,
      timer_started_at: new Date().toISOString(),
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "second_half" });
  };

  const pause = async () => {
    const acc = getElapsedSeconds(match);
    const { error } = await supabase.from("matches").update({
      status: "paused",
      timer_started_at: null,
      accumulated_seconds: acc,
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "pause" });
  };

  const resume = async () => {
    const half = match.current_half === 2 ? "second_half" : "first_half";
    const { error } = await supabase.from("matches").update({
      status: half,
      timer_started_at: new Date().toISOString(),
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "resume" });
  };

  const fulltime = async () => {
    if (!confirm("End the match?")) return;
    await endMatchNow();
  };

  const endMatchNow = async () => {
    const acc = getElapsedSeconds(match);
    const fa = match.first_half_actual_seconds ?? Math.min(acc, firstHalfLimitSec);
    const { error } = await supabase.from("matches").update({
      status: "finished",
      timer_started_at: null,
      accumulated_seconds: acc,
      second_half_actual_seconds: Math.max(0, acc - fa),
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "fulltime" });
  };

  const addStoppage = async (extraMinutes: number) => {
    const seconds = Math.round(extraMinutes * 60);
    if (!seconds) return;
    const field = match.current_half === 2 ? "second_half_stoppage_seconds" : "first_half_stoppage_seconds";
    const current = match[field] ?? 0;
    const payload: any = { [field]: current + seconds };
    const { error } = await supabase.from("matches").update(payload).eq("id", matchId);
    if (error) return toast.error(error.message);
    toast.success(`Added +${extraMinutes}' stoppage time`);
  };

  // Auto-end the current half when the hard limit (configured + stoppage) is reached,
  // so matches can never run indefinitely if admin ignores the prompt.
  useEffect(() => {
    if (!(inFirst || inSecond)) return;
    if (currentHalfElapsed < currentHalfLimitSec) return;
    if (autoEndedRef.current) return;
    autoEndedRef.current = true;
    if (inFirst) {
      // Auto-finish first half at configured (+ stoppage) duration.
      const acc = getElapsedSeconds(match);
      finishFirstHalf(acc, match.second_half_minutes ?? baseMph);
      toast.message("Half time reached — auto-ending first half");
    } else if (inSecond) {
      endMatchNow();
      toast.message("Full time reached — auto-ending match");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inFirst, inSecond, currentHalfElapsed, currentHalfLimitSec]);

  // Reset auto-end guard when the half changes.
  useEffect(() => {
    autoEndedRef.current = false;
  }, [match.status, match.current_half]);

  const [event, setEvent] = useState<null | "goal" | "yellow_card" | "red_card" | "substitution" | "foul">(null);

  if (match.status === "finished") {
    return <div className="rounded-xl border bg-card p-3 text-center text-sm text-muted-foreground">Match finished.</div>;
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {showStoppage && (
        <div className="rounded-lg border border-dashed bg-muted/40 p-2 space-y-2">
          <div className="text-xs font-semibold flex items-center justify-between">
            <span>{inSecond ? "Full time approaching — add stoppage?" : "Half time approaching — add stoppage?"}</span>
            <span className="text-muted-foreground">
              Current: +{Math.round((match.current_half === 2 ? match.second_half_stoppage_seconds : match.first_half_stoppage_seconds) / 60) || 0}'
            </span>
          </div>
          {recentSuggestion && (
            <div className="text-[11px] text-muted-foreground">Suggested due to: {recentSuggestion}</div>
          )}
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5].map((m) => (
              <Button key={m} size="sm" variant="outline" onClick={() => addStoppage(m)}>+{m}'</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => {
              const v = prompt("Custom stoppage minutes:");
              const n = Number(v);
              if (n > 0) addStoppage(n);
            }}>Custom</Button>
            <Button size="sm" variant="destructive" onClick={() => { inSecond ? endMatchNow() : halftime(); }}>
              End {inSecond ? "match" : "half"} now
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {match.status === "scheduled" && (
          <Button onClick={start} className="flex-1"><Play className="h-4 w-4 mr-1" />Kick off</Button>
        )}
        {match.status === "first_half" && (
          <>
            <Button onClick={pause} variant="outline" className="flex-1"><Pause className="h-4 w-4 mr-1" />Pause</Button>
            <Button onClick={halftime} className="flex-1"><Flag className="h-4 w-4 mr-1" />Half time</Button>
          </>
        )}
        {match.status === "halftime" && (
          <Button onClick={secondHalf} className="flex-1"><Play className="h-4 w-4 mr-1" />Start 2nd half</Button>
        )}
        {match.status === "second_half" && (
          <>
            <Button onClick={pause} variant="outline" className="flex-1"><Pause className="h-4 w-4 mr-1" />Pause</Button>
            <Button onClick={fulltime} disabled={!fullTimeReached} className="flex-1"><Square className="h-4 w-4 mr-1" />Full time</Button>
          </>
        )}
        {match.status === "paused" && (
          <Button onClick={resume} className="flex-1"><Play className="h-4 w-4 mr-1" />Resume</Button>
        )}
      </div>

      {(match.status === "first_half" || match.status === "second_half" || match.status === "paused" || match.status === "halftime") && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setEvent("goal")} className="h-14 text-base bg-primary"><GoalIcon className="h-5 w-5 mr-1" />Goal</Button>
          <Button onClick={() => setEvent("foul")} variant="outline" className="h-14 text-base"><Flag className="h-5 w-5 mr-1" />Foul</Button>
          <Button onClick={() => setEvent("yellow_card")} variant="outline" className="h-14 text-base"><RectangleVertical className="h-5 w-5 mr-1 text-yellow-500" />Yellow</Button>
          <Button onClick={() => setEvent("red_card")} variant="outline" className="h-14 text-base"><RectangleVertical className="h-5 w-5 mr-1 text-red-600" />Red</Button>
          <Button onClick={() => setEvent("substitution")} variant="outline" className="h-14 text-base col-span-2"><ArrowLeftRight className="h-5 w-5 mr-1" />Sub</Button>
        </div>
      )}

      <EventDialog
        kind={event}
        match={match}
        minute={minute}
        onClose={() => setEvent(null)}
      />

      <HalftimePrompt
        open={halftimePrompt}
        onOpenChange={setHalftimePrompt}
        elapsedSec={getElapsedSeconds(match)}
        baseMph={baseMph}
        onConfirm={(secondHalfMin) => finishFirstHalf(getElapsedSeconds(match), secondHalfMin)}
      />
    </div>
  );
}

function HalftimePrompt({ open, onOpenChange, elapsedSec, baseMph, onConfirm }:
  { open: boolean; onOpenChange: (o: boolean) => void; elapsedSec: number; baseMph: number; onConfirm: (m: number) => void }) {
  const mirrored = Math.max(1, Math.round(elapsedSec / 60));
  const [mode, setMode] = useState<"mirror" | "original" | "custom">("mirror");
  const [custom, setCustom] = useState(String(baseMph));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>First half ended early</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground text-xs">
            First half lasted {mirrored} min (configured {baseMph}). Choose second-half duration:
          </p>
          <button type="button" onClick={() => setMode("mirror")}
            className={`w-full rounded-md border p-2 text-left ${mode === "mirror" ? "border-primary bg-primary/10 text-primary" : ""}`}>
            Mirror first half ({mirrored} min)
          </button>
          <button type="button" onClick={() => setMode("original")}
            className={`w-full rounded-md border p-2 text-left ${mode === "original" ? "border-primary bg-primary/10 text-primary" : ""}`}>
            Use original configured ({baseMph} min)
          </button>
          <button type="button" onClick={() => setMode("custom")}
            className={`w-full rounded-md border p-2 text-left ${mode === "custom" ? "border-primary bg-primary/10 text-primary" : ""}`}>
            Custom
          </button>
          {mode === "custom" && (
            <input type="number" min={1} value={custom} onChange={(e) => setCustom(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
          )}
          <Button className="w-full" onClick={() => {
            const m = mode === "mirror" ? mirrored : mode === "original" ? baseMph : Math.max(1, Number(custom) || baseMph);
            onConfirm(m);
          }}>Confirm half time</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatchSummary({ match }: { match: any }) {
  const baseMph = match.minutes_per_half ?? 45;
  const halves = match.number_of_halves ?? 2;
  const fmt = (sec?: number | null) => sec == null ? "—" : `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;
  const total = (match.first_half_actual_seconds ?? 0) + (match.second_half_actual_seconds ?? 0);
  const secondConfigured = match.second_half_minutes ?? baseMph;
  return (
    <section className="rounded-xl border bg-card p-3 space-y-2">
      <h2 className="font-semibold">Match report</h2>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Configured 1st half</dt>
        <dd>{baseMph} min</dd>
        <dt className="text-muted-foreground">Actual 1st half</dt>
        <dd>{fmt(match.first_half_actual_seconds)}</dd>
        <dt className="text-muted-foreground">Configured 2nd half</dt>
        <dd>{secondConfigured} min</dd>
        <dt className="text-muted-foreground">Actual 2nd half</dt>
        <dd>{fmt(match.second_half_actual_seconds)}</dd>
        <dt className="text-muted-foreground">1st half stoppage</dt>
        <dd>+{Math.round((match.first_half_stoppage_seconds ?? 0) / 60)}'</dd>
        <dt className="text-muted-foreground">2nd half stoppage</dt>
        <dd>+{Math.round((match.second_half_stoppage_seconds ?? 0) / 60)}'</dd>
        <dt className="text-muted-foreground font-medium">Total match length</dt>
        <dd className="font-semibold">{fmt(total)}</dd>
      </dl>
      <p className="text-[10px] text-muted-foreground">Halves played: {halves}</p>
    </section>
  );
}

function EventDialog({ kind, match, minute, onClose }: { kind: string | null; match: any; minute: number; onClose: () => void }) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [subInId, setSubInId] = useState<string | null>(null);
  const [editMinute, setEditMinute] = useState<string>("");
  const [foulOutcome, setFoulOutcome] = useState<string>("direct_free_kick");
  const [cardType, setCardType] = useState<"none" | "yellow" | "red">("none");
  const [cardPlayerId, setCardPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (kind) {
      setTeamId(null); setPlayerId(null); setAssistId(null); setSubInId(null);
      setEditMinute(String(minute));
      setFoulOutcome("direct_free_kick"); setCardType("none"); setCardPlayerId(null);
    }
  }, [kind, minute]);

  const { data: players } = useQuery<Player[]>({
    queryKey: ["roster", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, jersey_number, team_id")
        .eq("team_id", teamId!)
        .order("jersey_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Player[];
    },
  });

  const submit = async () => {
    if (!teamId) return;
    const min = Number(editMinute) || minute;
    const base: any = { match_id: match.id, team_id: teamId, minute: min, type: kind };
    if (kind === "goal") {
      if (!playerId) return toast.error("Pick scorer");
      base.player_id = playerId;
      base.assist_player_id = assistId;
      if (teamId === match.home_team_id) {
        const { error: e1 } = await supabase.from("matches").update({ home_score: (match.home_score ?? 0) + 1 }).eq("id", match.id);
        if (e1) return toast.error(e1.message);
      } else {
        const { error: e1 } = await supabase.from("matches").update({ away_score: (match.away_score ?? 0) + 1 }).eq("id", match.id);
        if (e1) return toast.error(e1.message);
      }
    } else if (kind === "yellow_card" || kind === "red_card") {
      if (!playerId) return toast.error("Pick player");
      base.player_id = playerId;
    } else if (kind === "substitution") {
      if (!playerId || !subInId) return toast.error("Pick both players");
      base.player_id = playerId; // off
      base.sub_in_player_id = subInId; // on
    } else if (kind === "foul") {
      if (!playerId) return toast.error("Pick offending player");
      base.player_id = playerId;
      base.foul_outcome = foulOutcome;
      if (cardType !== "none") {
        base.card_type = cardType;
        base.card_player_id = cardPlayerId ?? playerId;
      }
    }
    const { error } = await supabase.from("match_events").insert(base);
    if (error) return toast.error(error.message);
    onClose();
  };

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="capitalize">{kind?.replace("_", " ")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Team</div>
            <div className="grid grid-cols-2 gap-2">
              {[match.home_team, match.away_team].map((t: any) => (
                <button key={t.id} type="button" onClick={() => { setTeamId(t.id); setPlayerId(null); setAssistId(null); setSubInId(null); }}
                  className={`rounded-md border p-2 text-sm font-medium ${teamId === t.id ? "border-primary bg-primary/10 text-primary" : ""}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {teamId && (
            <>
              <PlayerPicker label={kind === "substitution" ? "Player off" : kind === "goal" ? "Scorer" : kind === "foul" ? "Offending player" : "Player"}
                players={players ?? []} value={playerId} onChange={setPlayerId} />
              {kind === "goal" && (
                <PlayerPicker label="Assist (optional)" players={(players ?? []).filter((p) => p.id !== playerId)}
                  value={assistId} onChange={setAssistId} allowNone />
              )}
              {kind === "substitution" && (
                <PlayerPicker label="Player on" players={(players ?? []).filter((p) => p.id !== playerId)}
                  value={subInId} onChange={setSubInId} />
              )}
              {kind === "foul" && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Foul outcome</div>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        ["direct_free_kick", "Direct FK"],
                        ["indirect_free_kick", "Indirect FK"],
                        ["penalty", "Penalty"],
                        ["advantage", "Advantage"],
                        ["no_action", "No action"],
                      ].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setFoulOutcome(v)}
                          className={`rounded-md border p-2 text-xs ${foulOutcome === v ? "border-primary bg-primary/10 text-primary" : ""}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Card</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        ["none", "No card"],
                        ["yellow", "🟨 Yellow"],
                        ["red", "🟥 Red"],
                      ].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => { setCardType(v as any); setCardPlayerId(playerId); }}
                          className={`rounded-md border p-2 text-xs ${cardType === v ? "border-primary bg-primary/10 text-primary" : ""}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {cardType !== "none" && (
                    <PlayerPicker label="Player receiving card"
                      players={players ?? []} value={cardPlayerId} onChange={setCardPlayerId} />
                  )}
                </>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Minute</div>
                <input type="number" value={editMinute} onChange={(e) => setEditMinute(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
              </div>
              <Button onClick={submit} className="w-full">Confirm</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayerPicker({ label, players, value, onChange, allowNone }: { label: string; players: Player[]; value: string | null; onChange: (id: string | null) => void; allowNone?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {players.length === 0 ? (
        <p className="text-xs text-muted-foreground">No players in this team's roster.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
          {allowNone && (
            <button type="button" onClick={() => onChange(null)} className={`rounded-md border p-2 text-xs ${value === null ? "border-primary bg-primary/10 text-primary" : ""}`}>None</button>
          )}
          {players.map((p) => (
            <button key={p.id} type="button" onClick={() => onChange(p.id)}
              className={`rounded-md border p-2 text-xs truncate ${value === p.id ? "border-primary bg-primary/10 text-primary" : ""}`}>
              <span className="font-bold">{p.jersey_number ?? "·"}</span> {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}