import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeStandings } from "@/lib/standings";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments/$tournamentId")({
  component: TournamentDetail,
});

function TournamentDetail() {
  const { tournamentId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: t } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: tt } = useQuery({
    queryKey: ["tt", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_teams")
        .select("team_id, teams(id, name, logo_url)")
        .eq("tournament_id", tournamentId);
      if (error) throw error;
      return data;
    },
  });

  const { data: matches } = useQuery({
    queryKey: ["matches", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)")
        .eq("tournament_id", tournamentId)
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = t && user?.id === t.creator_id;
  const teamIds = (tt ?? []).map((x: any) => x.team_id);
  const standings = computeStandings((matches ?? []) as any, teamIds);
  const nameOf = (id: string) => (tt ?? []).find((x: any) => x.team_id === id)?.teams?.name ?? "—";

  if (!t) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t.name}</h1>
        <p className="text-xs text-muted-foreground uppercase">{t.format} · {t.status}</p>
        {t.description && <p className="text-sm mt-1">{t.description}</p>}
        {isAdmin && <DeleteTournament tournament={t} matches={matches ?? []} />}
      </div>

      <Tabs defaultValue="matches">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="space-y-3">
          {isAdmin && <NewMatchForm tournamentId={tournamentId} teams={tt ?? []} onCreated={() => qc.invalidateQueries({ queryKey: ["matches", tournamentId] })} />}
          {matches && matches.length > 0 ? (
            <ul className="space-y-2">
              {matches.map((m: any) => (
                <li key={m.id}>
                  <Link to="/matches/$matchId" params={{ matchId: m.id }} className="block rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex-1">{m.home_team?.name}</span>
                      <span className="px-3 font-bold tabular-nums">{m.home_score} - {m.away_score}</span>
                      <span className="font-medium flex-1 text-right">{m.away_team?.name}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground uppercase">{m.status.replace("_", " ")}</div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No matches yet.</p>
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-3">
          {isAdmin && <AddTeamForm tournamentId={tournamentId} existingIds={teamIds} onAdded={() => qc.invalidateQueries({ queryKey: ["tt", tournamentId] })} />}
          {tt && tt.length > 0 ? (
            <ul className="space-y-2">
              {tt.map((x: any) => (
                <li key={x.team_id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  {x.teams?.logo_url ? (
                    <img src={x.teams.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted" />
                  )}
                  <span className="flex-1 font-medium">{x.teams?.name}</span>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        if (!confirm("Remove team from tournament?")) return;
                        const { error } = await supabase.from("tournament_teams").delete().eq("tournament_id", tournamentId).eq("team_id", x.team_id);
                        if (error) return toast.error(error.message);
                        qc.invalidateQueries({ queryKey: ["tt", tournamentId] });
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
            <p className="text-sm text-muted-foreground text-center py-6">No teams added yet.</p>
          )}
        </TabsContent>

        <TabsContent value="standings">
          {standings.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-muted">
                  <tr>
                    <th className="text-left p-2">Team</th>
                    <th className="p-2">P</th><th className="p-2">W</th><th className="p-2">D</th><th className="p-2">L</th>
                    <th className="p-2">GF</th><th className="p-2">GA</th><th className="p-2">GD</th>
                    <th className="p-2 font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((r) => (
                    <tr key={r.team_id} className="border-t">
                      <td className="p-2 text-left font-medium">{nameOf(r.team_id)}</td>
                      <td className="p-2 text-center">{r.played}</td>
                      <td className="p-2 text-center">{r.won}</td>
                      <td className="p-2 text-center">{r.drawn}</td>
                      <td className="p-2 text-center">{r.lost}</td>
                      <td className="p-2 text-center">{r.gf}</td>
                      <td className="p-2 text-center">{r.ga}</td>
                      <td className="p-2 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                      <td className="p-2 text-center font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Standings appear once matches are played.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddTeamForm({ tournamentId, existingIds, onAdded }: { tournamentId: string; existingIds: string[]; onAdded: () => void }) {
  const { data: teams } = useQuery({
    queryKey: ["all-teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").eq("is_archived", false).order("name");
      if (error) throw error;
      return data;
    },
  });
  const [pick, setPick] = useState("");
  const available = (teams ?? []).filter((t) => !existingIds.includes(t.id));
  const add = async () => {
    if (!pick) return;
    const { error } = await supabase.from("tournament_teams").insert({ tournament_id: tournamentId, team_id: pick });
    if (error) return toast.error(error.message);
    setPick("");
    onAdded();
  };
  if (available.length === 0) return <p className="text-xs text-muted-foreground">All your teams are added. Create more in Teams.</p>;
  return (
    <div className="flex gap-2">
      <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 rounded-md border bg-background px-2 py-2 text-sm">
        <option value="">Add team…</option>
        {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <Button onClick={add} size="sm" disabled={!pick}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}

function NewMatchForm({ tournamentId, teams, onCreated }: { tournamentId: string; teams: any[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [when, setWhen] = useState("");
  const [halves, setHalves] = useState(2);
  const [mph, setMph] = useState(45);
  const [extra, setExtra] = useState(0);
  if (teams.length < 2) return null;
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (home === away) return toast.error("Pick two different teams");
    const { error } = await supabase.from("matches").insert({
      tournament_id: tournamentId,
      home_team_id: home,
      away_team_id: away,
      scheduled_at: when ? new Date(when).toISOString() : null,
      number_of_halves: halves,
      minutes_per_half: mph,
      extra_time_minutes_per_half: extra,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setHome(""); setAway(""); setWhen(""); setHalves(2); setMph(45); setExtra(0);
    onCreated();
  };
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Schedule match</Button>;
  return (
    <form onSubmit={create} className="rounded-xl border bg-card p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select required value={home} onChange={(e) => setHome(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
          <option value="">Home…</option>
          {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.teams.name}</option>)}
        </select>
        <select required value={away} onChange={(e) => setAway(e.target.value)} className="rounded-md border bg-background px-2 py-2 text-sm">
          <option value="">Away…</option>
          {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.teams.name}</option>)}
        </select>
      </div>
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full rounded-md border bg-background px-2 py-2 text-sm" />
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">Match duration</div>
        <div className="flex flex-wrap gap-1">
          {[20, 25, 30, 35, 40, 45].map((m) => (
            <button type="button" key={m} onClick={() => setMph(m)}
              className={`rounded-md border px-2 py-1 text-xs ${mph === m ? "border-primary bg-primary/10 text-primary" : ""}`}>
              {m}+{m}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <label className="text-xs">Halves
            <input type="number" min={1} max={4} value={halves} onChange={(e) => setHalves(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm" />
          </label>
          <label className="text-xs">Min/half
            <input type="number" min={1} max={60} value={mph} onChange={(e) => setMph(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm" />
          </label>
          <label className="text-xs">Extra/half
            <input type="number" min={0} max={30} value={extra} onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))} className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm" />
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">Create</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function DeleteTournament({ tournament, matches }: { tournament: any; matches: any[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const hasLive = matches.some((m) => ["first_half", "halftime", "second_half", "paused"].includes(m.status));

  const reset = () => { setStep(1); setConfirmName(""); };
  const close = () => { if (!deleting) { setOpen(false); reset(); } };

  const doDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Tournament deleted");
    setOpen(false);
    navigate({ to: "/tournaments" });
  };

  return (
    <>
      <Button variant="destructive" size="sm" className="mt-2" onClick={() => { reset(); setOpen(true); }}>
        <Trash2 className="h-4 w-4" /> Delete Tournament
      </Button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tournament?</DialogTitle>
          </DialogHeader>
          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to permanently delete this tournament and all related data? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={close}>Cancel</Button>
                <Button variant="destructive" onClick={() => setStep(hasLive ? 2 : 3)}>Delete Tournament</Button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-destructive font-medium">
                This tournament contains live or paused matches. Deleting it will permanently remove all associated match data.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={close}>Cancel</Button>
                <Button variant="destructive" onClick={() => setStep(3)}>I understand, continue</Button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <p className="text-sm">
                Type <span className="font-mono font-semibold">{tournament.name}</span> to confirm deletion.
              </p>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={tournament.name}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={close} disabled={deleting}>Cancel</Button>
                <Button variant="destructive" onClick={doDelete} disabled={deleting || confirmName.trim() !== tournament.name}>
                  {deleting ? "Deleting…" : "Permanently Delete"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}