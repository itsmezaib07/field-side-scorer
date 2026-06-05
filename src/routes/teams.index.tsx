import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlatformOwner } from "@/lib/use-platform-owner";
import { Plus, Shield, ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/teams/")({
  head: () => ({ meta: [{ title: "Teams — MatchPad" }] }),
  component: TeamsList,
});

function TeamsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["teams", showArchived ? "archived" : "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, description, logo_url, owner_id, is_archived, archived_at")
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const restore = async (id: string) => {
    const { error } = await supabase
      .from("teams")
      .update({ is_archived: false, archived_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Team restored.");
    qc.invalidateQueries({ queryKey: ["teams"] });
  };

  const hardDelete = async (id: string) => {
    if (!confirm("Permanently delete this team? This cannot be undone.")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Team deleted.");
    qc.invalidateQueries({ queryKey: ["teams"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{showArchived ? "Archived Teams" : "Teams"}</h1>
        {user && !showArchived && (
          <Link to="/teams/new" className="inline-flex items-center gap-1 text-sm text-primary">
            <Plus className="h-4 w-4" /> New team
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={!showArchived ? "default" : "outline"} onClick={() => setShowArchived(false)}>
          Active
        </Button>
        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(true)}>
          Archived
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <Link to="/teams/$teamId" params={{ teamId: t.id }} className="flex items-center gap-3 flex-1 min-w-0">
                {t.logo_url ? (
                  <img src={t.logo_url} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {t.name}
                    {t.is_archived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
                  </div>
                  {t.description && <div className="text-xs text-muted-foreground truncate">{t.description}</div>}
                </div>
                {user?.id === t.owner_id && <span className="text-[10px] text-primary uppercase">Owner</span>}
              </Link>
              {showArchived && user?.id === t.owner_id && (
                <div className="flex items-center gap-1">
                  <button onClick={() => restore(t.id)} title="Restore" className="p-1.5 text-muted-foreground hover:text-primary">
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                  <button onClick={() => hardDelete(t.id)} title="Delete permanently" className="p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {showArchived ? "No archived teams." : (user ? "No teams yet. Create the first one." : "Sign in to create one.")}
        </div>
      )}
    </div>
  );
}