import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Plus, Shield } from "lucide-react";

export const Route = createFileRoute("/teams/")({
  head: () => ({ meta: [{ title: "Teams — MatchPad" }] }),
  component: TeamsList,
});

function TeamsList() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, description, logo_url, owner_id, is_archived")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Teams</h1>
        {user && (
          <Link to="/teams/new" className="inline-flex items-center gap-1 text-sm text-primary">
            <Plus className="h-4 w-4" /> New team
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((t) => (
            <li key={t.id}>
              <Link to="/teams/$teamId" params={{ teamId: t.id }} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                {t.logo_url ? (
                  <img src={t.logo_url} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
                </div>
                {user?.id === t.owner_id && <span className="text-[10px] text-primary uppercase">Owner</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No teams yet. {user ? "Create the first one." : "Sign in to create one."}
        </div>
      )}
    </div>
  );
}