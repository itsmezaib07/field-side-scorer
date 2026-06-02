import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments/new")({
  component: NewTournament,
});

function NewTournament() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"league" | "knockout">("league");
  const [busy, setBusy] = useState(false);

  if (!user) return <p className="text-center py-8 text-muted-foreground">Please sign in.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ name, description: description || null, format, creator_id: user.id, status: "active" })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: data.id } });
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold">New tournament</h1>
      <div>
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <Label>Format</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {(["league", "knockout"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-md border p-3 text-sm font-medium capitalize ${format === f ? "border-primary bg-primary/10 text-primary" : ""}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={busy} className="w-full">Create tournament</Button>
    </form>
  );
}