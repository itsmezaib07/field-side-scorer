import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, Flag, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchPad — Live football scoring" },
      { name: "description", content: "Score local football matches live and let everyone follow in real time." },
      { property: "og:title", content: "MatchPad — Live football scoring" },
      { property: "og:description", content: "Score local football matches live and let everyone follow in real time." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();

  const { data: liveMatches } = useQuery({
    queryKey: ["live-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, home_score, away_score, status, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), tournament:tournaments(name)")
        .in("status", ["first_half", "halftime", "second_half", "paused"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  if (loading) return <div className="text-center text-muted-foreground py-8">Loading…</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
        <h1 className="text-2xl font-bold">{user ? "Welcome back" : "MatchPad"}</h1>
        <p className="mt-1 text-primary-foreground/80 text-sm">
          Live football scoring for local, school and amateur tournaments.
        </p>
        {!user && (
          <Link to="/auth" className="inline-block mt-4 rounded-md bg-background text-foreground px-4 py-2 text-sm font-medium">
            Get started
          </Link>
        )}
      </section>

      {user && (
        <section className="grid grid-cols-3 gap-2">
          <Link to="/teams" className="rounded-xl border bg-card p-3 text-center">
            <Users className="h-5 w-5 mx-auto text-primary" />
            <div className="mt-1 text-xs font-medium">Teams</div>
          </Link>
          <Link to="/tournaments" className="rounded-xl border bg-card p-3 text-center">
            <Trophy className="h-5 w-5 mx-auto text-primary" />
            <div className="mt-1 text-xs font-medium">Tournaments</div>
          </Link>
          <Link to="/tournaments/new" className="rounded-xl border bg-card p-3 text-center">
            <Plus className="h-5 w-5 mx-auto text-primary" />
            <div className="mt-1 text-xs font-medium">New</div>
          </Link>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Flag className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">Live now</h2>
        </div>
        {liveMatches && liveMatches.length > 0 ? (
          <div className="space-y-2">
            {liveMatches.map((m: any) => (
              <Link key={m.id} to="/matches/$matchId" params={{ matchId: m.id }} className="block rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">{m.tournament?.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-medium">{m.home_team?.name}</span>
                  <span className="text-lg font-bold tabular-nums">{m.home_score} - {m.away_score}</span>
                  <span className="font-medium">{m.away_team?.name}</span>
                </div>
                <div className="mt-1 text-xs text-accent uppercase tracking-wide">{m.status.replace("_", " ")}</div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No live matches right now.</p>
        )}
      </section>
    </div>
  );
}
