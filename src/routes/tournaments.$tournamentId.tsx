import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
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
  if (teams.length < 2) return null;
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (home === away) return toast.error("Pick two different teams");
    const { error } = await supabase.from("matches").insert({
      tournament_id: tournamentId,
      home_team_id: home,
      away_team_id: away,
      scheduled_at: when ? new Date(when).toISOString() : null,
    });
    if (error) return toast.error(error.message);
    setOpen(false); setHome(""); setAway(""); setWhen("");
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
      <div className="flex gap-2">
        <Button type="submit" size="sm">Create</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}