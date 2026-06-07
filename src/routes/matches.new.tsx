import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/matches/new")({
  head: () => ({ meta: [{ title: "New Friendly Match — MatchPad" }] }),
  component: NewFriendlyMatch,
});

function NewFriendlyMatch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [duration, setDuration] = useState("90");
  const [location, setLocation] = useState("");
  const [competition, setCompetition] = useState("Friendly");
  const [saving, setSaving] = useState(false);

  const { data: teams } = useQuery({
    queryKey: ["my-teams-for-friendly", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!user) {
    return <p className="text-sm text-muted-foreground">Please sign in to create a friendly match.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam) return toast.error("Select both teams.");
    if (homeTeam === awayTeam) return toast.error("Home and away teams must differ.");
    const mins = Math.max(1, Math.min(240, Number(duration) || 90));
    const perHalf = Math.max(1, Math.round(mins / 2));
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    setSaving(true);
    const { data, error } = await supabase
      .from("matches")
      .insert({
        tournament_id: null,
        creator_id: user.id,
        home_team_id: homeTeam,
        away_team_id: awayTeam,
        scheduled_at: scheduledAt,
        minutes_per_half: perHalf,
        number_of_halves: 2,
        competition_name: competition.trim().slice(0, 100) || "Friendly",
        location: location.trim().slice(0, 200) || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Friendly match created.");
    navigate({ to: "/matches/$matchId", params: { matchId: data.id } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">New Friendly Match</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Quickly host a standalone match without creating a tournament.
      </p>

      <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-3">
        <div>
          <Label className="text-xs">Home Team</Label>
          <select
            required
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm h-9"
          >
            <option value="">Select team…</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Away Team</Label>
          <select
            required
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm h-9"
          >
            <option value="">Select team…</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Time</Label>
            <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Duration (minutes)</Label>
            <Input type="number" min={1} max={240} required value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Competition</Label>
            <Input maxLength={100} value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Friendly" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Location (optional)</Label>
          <Input maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Pitch / ground" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/" })} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Match"}</Button>
        </div>
      </form>
    </div>
  );
}