import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Mail, User } from "lucide-react";

type OwnerProfile = { id: string; email: string | null; full_name: string | null };

/**
 * Read-only card that always shows the permanent studio Owner.
 * Ownership cannot be transferred — every new signup joins as Staff.
 */
export const OwnerInfoCard = () => {
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // Security-definer lookup: always returns the current Owner's name + email,
    // even for staff accounts that cannot read other profiles directly.
    const { data, error } = await (supabase as any).rpc("get_workspace_owner_info");
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row?.user_id) {
      setOwner({ id: row.user_id, email: row.email ?? null, full_name: row.full_name ?? null });
    } else {
      const { data: role } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "owner")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (role?.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", role.user_id)
          .maybeSingle();
        setOwner((prof as OwnerProfile) ?? { id: role.user_id, email: null, full_name: null });
      } else {
        setOwner(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // Ownership transfers rewrite user_roles — refresh instantly for everyone.
    const ch = supabase
      .channel("owner-info-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" /> Studio Owner
        </CardTitle>
        <CardDescription>
          The current Owner of this studio workspace. Use Settings → Transfer Ownership to hand the role to a Staff account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : owner ? (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{owner.full_name || "Studio Owner"}</span>
              <Badge className="ml-auto">Owner</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{owner.email}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No owner account found.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default OwnerInfoCard;
