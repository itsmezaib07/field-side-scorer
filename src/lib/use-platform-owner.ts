import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function usePlatformOwner(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["platform-owner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "platform_owner")
        .maybeSingle();
      return !!data;
    },
  });
  return !!data;
}