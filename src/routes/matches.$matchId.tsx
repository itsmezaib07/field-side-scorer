import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
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
        .select("*, player:players!match_events_player_id_fkey(name, jersey_number), assist:players!match_events_assist_player_id_fkey(name), sub_in:players!match_events_sub_in_player_id_fkey(name, jersey_number)")
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
      </div>

      {isScorer && <ScoringPanel match={match} elapsed={elapsed} />}
      {isAdmin && <AdminPanel match={match} />}

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
    case "kickoff": return <span>▶ Kick off</span>;
    case "halftime": return <span>⏸ Half time</span>;
    case "second_half": return <span>▶ Second half</span>;
    case "fulltime": return <span>⏹ Full time</span>;
    case "pause": return <span>⏸ Paused</span>;
    case "resume": return <span>▶ Resumed</span>;
  }
}

function AdminPanel({ match }: { match: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground font-semibold">Admin</span>
        <button onClick={() => setOpen((x) => !x)} className="text-xs text-primary">{open ? "Hide" : "Manage scorers"}</button>
      </div>
      {open && <ScorersManager matchId={match.id} />}
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

function ScoringPanel({ match, elapsed }: { match: any; elapsed: number }) {
  const matchId = match.id;
  const minute = getMinute(elapsed);

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
    const { error } = await supabase.from("matches").update({
      status: "halftime",
      timer_started_at: null,
      accumulated_seconds: acc,
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "halftime" });
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
    const acc = getElapsedSeconds(match);
    const { error } = await supabase.from("matches").update({
      status: "finished",
      timer_started_at: null,
      accumulated_seconds: acc,
    }).eq("id", matchId);
    if (error) return toast.error(error.message);
    await log({ type: "fulltime" });
  };

  const [event, setEvent] = useState<null | "goal" | "yellow_card" | "red_card" | "substitution">(null);

  if (match.status === "finished") {
    return <div className="rounded-xl border bg-card p-3 text-center text-sm text-muted-foreground">Match finished.</div>;
  }

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
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
            <Button onClick={fulltime} className="flex-1"><Square className="h-4 w-4 mr-1" />Full time</Button>
          </>
        )}
        {match.status === "paused" && (
          <Button onClick={resume} className="flex-1"><Play className="h-4 w-4 mr-1" />Resume</Button>
        )}
      </div>

      {(match.status === "first_half" || match.status === "second_half" || match.status === "paused" || match.status === "halftime") && (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setEvent("goal")} className="h-14 text-base bg-primary"><GoalIcon className="h-5 w-5 mr-1" />Goal</Button>
          <Button onClick={() => setEvent("yellow_card")} variant="outline" className="h-14 text-base"><RectangleVertical className="h-5 w-5 mr-1 text-yellow-500" />Yellow</Button>
          <Button onClick={() => setEvent("red_card")} variant="outline" className="h-14 text-base"><RectangleVertical className="h-5 w-5 mr-1 text-red-600" />Red</Button>
          <Button onClick={() => setEvent("substitution")} variant="outline" className="h-14 text-base"><ArrowLeftRight className="h-5 w-5 mr-1" />Sub</Button>
        </div>
      )}

      <EventDialog
        kind={event}
        match={match}
        minute={minute}
        onClose={() => setEvent(null)}
      />
    </div>
  );
}

function EventDialog({ kind, match, minute, onClose }: { kind: string | null; match: any; minute: number; onClose: () => void }) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [subInId, setSubInId] = useState<string | null>(null);
  const [editMinute, setEditMinute] = useState<string>("");

  useEffect(() => {
    if (kind) { setTeamId(null); setPlayerId(null); setAssistId(null); setSubInId(null); setEditMinute(String(minute)); }
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
              <PlayerPicker label={kind === "substitution" ? "Player off" : kind === "goal" ? "Scorer" : "Player"}
                players={players ?? []} value={playerId} onChange={setPlayerId} />
              {kind === "goal" && (
                <PlayerPicker label="Assist (optional)" players={(players ?? []).filter((p) => p.id !== playerId)}
                  value={assistId} onChange={setAssistId} allowNone />
              )}
              {kind === "substitution" && (
                <PlayerPicker label="Player on" players={(players ?? []).filter((p) => p.id !== playerId)}
                  value={subInId} onChange={setSubInId} />
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