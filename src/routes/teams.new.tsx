import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ImageUploader } from "@/components/ImageUploader";

export const Route = createFileRoute("/teams/new")({
  head: () => ({ meta: [{ title: "New team — MatchPad" }] }),
  component: NewTeam,
});

function NewTeam() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return <p className="text-center text-muted-foreground py-8">Please sign in.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("teams")
      .insert({ name, description: description || null, logo_url: logoUrl || null, owner_id: user.id })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Team created");
    navigate({ to: "/teams/$teamId", params: { teamId: data.id } });
  };

  return (
    <form onSubmit={submit} className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold">New team</h1>
      <div>
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <ImageUploader
        value={logoUrl}
        onChange={setLogoUrl}
        folder="team-logos"
        label="Team logo (optional)"
        shape="circle"
      />
      <Button type="submit" disabled={busy} className="w-full">Create team</Button>
    </form>
  );
}