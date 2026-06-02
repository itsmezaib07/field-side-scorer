import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teams/$teamId")({
  component: TeamDetail,
});

function TeamDetail() {
  const { teamId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: team } = useQuery({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").eq("id", teamId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: players } = useQuery({
    queryKey: ["players", teamId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId)
        .order("jersey_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  // Stats per player (goals/assists/yc/rc/matches)
  const { data: stats } = useQuery({
    queryKey: ["player-stats", teamId],
    queryFn: async () => {
      const { data: ev } = await supabase
        .from("match_events")
        .select("type, player_id, assist_player_id, match_id, team_id")
        .eq("team_id", teamId);
      const { data: sq } = await supabase
        .from("match_squads")
        .select("player_id, match_id")
        .eq("team_id", teamId);
      const map = new Map<string, { goals: number; assists: number; yc: number; rc: number; matches: number }>();
      const get = (id: string) => {
        if (!map.has(id)) map.set(id, { goals: 0, assists: 0, yc: 0, rc: 0, matches: 0 });
        return map.get(id)!;
      };
      for (const e of ev ?? []) {
        if (e.player_id) {
          const s = get(e.player_id);
          if (e.type === "goal") s.goals++;
          if (e.type === "yellow_card") s.yc++;
          if (e.type === "red_card") s.rc++;
        }
        if (e.type === "goal" && e.assist_player_id) get(e.assist_player_id).assists++;
      }
      const playerMatchSet = new Map<string, Set<string>>();
      for (const s of sq ?? []) {
        if (!playerMatchSet.has(s.player_id)) playerMatchSet.set(s.player_id, new Set());
        playerMatchSet.get(s.player_id)!.add(s.match_id);
      }
      for (const [pid, set] of playerMatchSet) get(pid).matches = set.size;
      return map;
    },
  });

  const isOwner = team && user?.id === team.owner_id;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [pos, setPos] = useState("");
  const [photo, setPhoto] = useState("");

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("players").insert({
      team_id: teamId,
      name,
      jersey_number: num ? Number(num) : null,
      position: pos || null,
      photo_url: photo || null,
    });
    if (error) return toast.error(error.message);
    setName(""); setNum(""); setPos(""); setPhoto("");
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["players", teamId] });
  };

  const removePlayer = async (id: string) => {
    if (!confirm("Remove this player?")) return;
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["players", teamId] });
  };

  if (!team) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {team.logo_url ? (
          <img src={team.logo_url} alt={team.name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold">{team.name}</h1>
          {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Players ({players?.length ?? 0})</h2>
        {isOwner && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={addPlayer} className="space-y-2 rounded-xl border bg-card p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">#</Label>
              <Input type="number" value={num} onChange={(e) => setNum(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Position</Label>
            <Input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="GK / DEF / MID / FWD" />
          </div>
          <div>
            <Label className="text-xs">Photo URL (optional)</Label>
            <Input value={photo} onChange={(e) => setPhoto(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {players?.map((p) => {
          const s = stats?.get(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              {p.photo_url ? (
                <img src={p.photo_url} alt={p.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {p.jersey_number ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.position ?? "—"} · {s?.matches ?? 0} MP · {s?.goals ?? 0}G {s?.assists ?? 0}A · {s?.yc ?? 0}🟨 {s?.rc ?? 0}🟥
                </div>
              </div>
              {isOwner && (
                <button onClick={() => removePlayer(p.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}