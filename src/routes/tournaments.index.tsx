import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Plus, Trophy } from "lucide-react";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({ meta: [{ title: "Tournaments — MatchPad" }] }),
  component: List,
});

function List() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, name, description, format, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tournaments</h1>
        {user && (
          <Link to="/tournaments/new" className="inline-flex items-center gap-1 text-sm text-primary">
            <Plus className="h-4 w-4" /> New
          </Link>
        )}
      </div>
      {data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((t) => (
            <li key={t.id}>
              <Link to="/tournaments/$tournamentId" params={{ tournamentId: t.id }} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <Trophy className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground uppercase">{t.format} · {t.status}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">No tournaments yet.</p>
      )}
    </div>
  );
}