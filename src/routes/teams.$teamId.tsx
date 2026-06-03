import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Plus, Trash2, Pencil } from "lucide-react";
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
        .select("type, player_id, assist_player_id, match_id, team_id, card_type, card_player_id")
        .eq("team_id", teamId);
      const { data: sq } = await supabase
        .from("match_squads")
        .select("player_id, match_id")
        .eq("team_id", teamId);
      const map = new Map<string, { goals: number; assists: number; yc: number; rc: number; fouls: number; matches: number }>();
      const get = (id: string) => {
        if (!map.has(id)) map.set(id, { goals: 0, assists: 0, yc: 0, rc: 0, fouls: 0, matches: 0 });
        return map.get(id)!;
      };
      for (const e of ev ?? []) {
        if (e.player_id) {
          const s = get(e.player_id);
          if (e.type === "goal") s.goals++;
          if (e.type === "yellow_card") s.yc++;
          if (e.type === "red_card") s.rc++;
          if (e.type === "foul") s.fouls++;
        }
        if (e.type === "goal" && e.assist_player_id) get(e.assist_player_id).assists++;
        const anyE = e as any;
        if (e.type === "foul" && anyE.card_player_id) {
          const s = get(anyE.card_player_id);
          if (anyE.card_type === "yellow") s.yc++;
          if (anyE.card_type === "red") s.rc++;
        }
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

  const { data: canAdmin } = useQuery({
    queryKey: ["team-admin", teamId, user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_teams")
        .select("tournaments!inner(creator_id)")
        .eq("team_id", teamId);
      return (data ?? []).some((row: any) => row.tournaments?.creator_id === user!.id);
    },
  });
  const isOwner = team && user?.id === team.owner_id;
  const canEdit = !!(isOwner || canAdmin);
  const [adding, setAdding] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
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
          {(team.home_ground || team.team_colors || team.contact_info) && (
            <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
              {team.home_ground && <div>Home ground: {team.home_ground}</div>}
              {team.team_colors && <div>Colors: {team.team_colors}</div>}
              {team.contact_info && <div>Contact: {team.contact_info}</div>}
            </div>
          )}
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setEditingTeam(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Players ({players?.length ?? 0})</h2>
        {canEdit && !adding && (
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
              {canEdit && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingPlayer(p)} className="text-muted-foreground hover:text-primary">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => removePlayer(p.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editingTeam && (
        <EditTeamDialog
          team={team}
          onClose={() => setEditingTeam(false)}
          onSaved={() => { setEditingTeam(false); qc.invalidateQueries({ queryKey: ["team", teamId] }); }}
        />
      )}
      {editingPlayer && (
        <EditPlayerDialog
          player={editingPlayer}
          teamId={teamId}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => { setEditingPlayer(null); qc.invalidateQueries({ queryKey: ["players", teamId] }); }}
        />
      )}
    </div>
  );
}

function EditTeamDialog({ team, onClose, onSaved }: { team: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(team.name ?? "");
  const [description, setDescription] = useState(team.description ?? "");
  const [logoUrl, setLogoUrl] = useState(team.logo_url ?? "");
  const [homeGround, setHomeGround] = useState(team.home_ground ?? "");
  const [teamColors, setTeamColors] = useState(team.team_colors ?? "");
  const [contactInfo, setContactInfo] = useState(team.contact_info ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Team name is required");
    setSaving(true);
    const { error } = await supabase.from("teams").update({
      name: name.trim().slice(0, 100),
      description: description.trim().slice(0, 500) || null,
      logo_url: logoUrl.trim().slice(0, 500) || null,
      home_ground: homeGround.trim().slice(0, 200) || null,
      team_colors: teamColors.trim().slice(0, 100) || null,
      contact_info: contactInfo.trim().slice(0, 200) || null,
    }).eq("id", team.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Changes saved successfully.");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-2">
          <div><Label className="text-xs">Team Name</Label><Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Description</Label><Input maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label className="text-xs">Logo URL</Label><Input maxLength={500} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} /></div>
          <div><Label className="text-xs">Home Ground</Label><Input maxLength={200} value={homeGround} onChange={(e) => setHomeGround(e.target.value)} /></div>
          <div><Label className="text-xs">Team Colors</Label><Input maxLength={100} value={teamColors} onChange={(e) => setTeamColors(e.target.value)} placeholder="e.g. Red & White" /></div>
          <div><Label className="text-xs">Contact Info</Label><Input maxLength={200} value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlayerDialog({ player, teamId, onClose, onSaved }: { player: any; teamId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(player.name ?? "");
  const [num, setNum] = useState(player.jersey_number?.toString() ?? "");
  const [pos, setPos] = useState(player.position ?? "");
  const [photo, setPhoto] = useState(player.photo_url ?? "");
  const [dob, setDob] = useState(player.date_of_birth ?? "");
  const [newTeamId, setNewTeamId] = useState(player.team_id ?? teamId);
  const [saving, setSaving] = useState(false);

  // Teams the current user owns (for reassignment)
  const { data: ownTeams } = useQuery({
    queryKey: ["own-teams-for-move"],
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, name");
      return data ?? [];
    },
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Player name is required");
    setSaving(true);
    const { error } = await supabase.from("players").update({
      name: name.trim().slice(0, 100),
      jersey_number: num ? Math.max(0, Math.min(999, Number(num))) : null,
      position: pos.trim().slice(0, 50) || null,
      photo_url: photo.trim().slice(0, 500) || null,
      date_of_birth: dob || null,
      team_id: newTeamId,
    }).eq("id", player.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Changes saved successfully.");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Player</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><Label className="text-xs">Name</Label><Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label className="text-xs">#</Label><Input type="number" min={0} max={999} value={num} onChange={(e) => setNum(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Position</Label><Input maxLength={50} value={pos} onChange={(e) => setPos(e.target.value)} placeholder="GK / DEF / MID / FWD" /></div>
          <div><Label className="text-xs">Photo URL</Label><Input maxLength={500} value={photo} onChange={(e) => setPhoto(e.target.value)} /></div>
          <div><Label className="text-xs">Date of Birth</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Team</Label>
            <select value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1 text-sm h-9">
              {(ownTeams ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Stats stay linked to this player after team changes.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}