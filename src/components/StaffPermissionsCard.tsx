import { useEffect, useState } from "react";
import { useStudio, ModuleKey } from "@/contexts/StudioContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, Mail, Trash2, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type StaffRow = {
  user_id: string;
  owner_id: string;
  email: string | null;
  full_name: string | null;
  can_customers: boolean;
  can_gallery: boolean;
  can_classes: boolean;
  can_payments: boolean;
  can_renewals: boolean;
  is_active: boolean;
};

type Invite = { id: string; email: string; accepted_at: string | null };

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "customers", label: "Members" },
  { key: "gallery", label: "My Gallery" },
  { key: "classes", label: "Classes" },
  { key: "payments", label: "Payments" },
  { key: "renewals", label: "Renewals" },
];

export const StaffPermissionsCard = () => {
  const { ownerId, isOwner } = useStudio();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);

    // Fetch staff role rows for this owner
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, owner_id, role")
      .eq("owner_id", ownerId)
      .eq("role", "staff");

    const staffIds = (roles ?? []).map((r) => r.user_id);
    let rows: StaffRow[] = [];
    if (staffIds.length) {
      const [{ data: profiles }, { data: perms }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name").in("id", staffIds),
        supabase
          .from("staff_permissions" as any)
          .select("staff_user_id,owner_id,can_customers,can_gallery,can_classes,can_payments,can_renewals,is_active")
          .in("staff_user_id", staffIds),
      ]);
      const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const permMap = new Map((perms as any[] ?? []).map((p: any) => [p.staff_user_id, p]));
      rows = staffIds.map((id) => {
        const prof: any = profMap.get(id) ?? {};
        const perm: any = permMap.get(id) ?? {
          can_customers: true, can_gallery: true, can_classes: true,
          can_payments: false, can_renewals: true, is_active: true,
        };
        return {
          user_id: id,
          owner_id: ownerId,
          email: prof.email ?? null,
          full_name: prof.full_name ?? null,
          can_customers: perm.can_customers,
          can_gallery: perm.can_gallery,
          can_classes: perm.can_classes,
          can_payments: perm.can_payments,
          can_renewals: perm.can_renewals,
          is_active: perm.is_active,
        };
      });
    }
    setStaff(rows);

    const { data: inv } = await supabase
      .from("staff_invitations")
      .select("id, email, accepted_at")
      .eq("owner_id", ownerId)
      .is("accepted_at", null);
    setInvites((inv ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  if (!isOwner) return null;

  const togglePerm = async (row: StaffRow, key: keyof StaffRow, next: boolean) => {
    setSaving(row.user_id);
    const patch: any = { [key]: next };
    const { error } = await supabase
      .from("staff_permissions" as any)
      .upsert({
        staff_user_id: row.user_id,
        owner_id: row.owner_id,
        can_customers: row.can_customers,
        can_gallery: row.can_gallery,
        can_classes: row.can_classes,
        can_payments: row.can_payments,
        can_renewals: row.can_renewals,
        is_active: row.is_active,
        ...patch,
      } as any, { onConflict: "staff_user_id" });
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Permission updated");
    setStaff((s) => s.map((r) => (r.user_id === row.user_id ? { ...r, [key]: next } as StaffRow : r)));
  };

  const setActive = async (row: StaffRow, active: boolean) => {
    await togglePerm(row, "is_active", active);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerId) return;
    const cleaned = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleaned)) { toast.error("Enter a valid email"); return; }
    const { error } = await supabase
      .from("staff_invitations")
      .insert({ owner_id: ownerId, email: cleaned });
    if (error) {
      toast.error(error.code === "23505" ? "That email is already invited" : error.message);
      return;
    }
    toast.success("Invitation saved — ask them to sign up with this email");
    setInviteEmail("");
    load();
  };

  const revokeInvite = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this record? This action cannot be undone.")) return;
    await supabase.from("staff_invitations").delete().eq("id", id);
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Users className="h-5 w-5" /> Staff &amp; Permissions
        </CardTitle>
        <CardDescription>
          Invite staff, control which modules they can access, and deactivate accounts when needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite */}
        <form onSubmit={handleInvite} className="rounded-lg border p-4 space-y-3">
          <Label className="flex items-center gap-2 font-medium"><UserPlus className="h-4 w-4" /> Invite a staff member</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email" required maxLength={255}
              placeholder="staff@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Button type="submit">Send Invitation</Button>
          </div>
          <p className="text-xs text-muted-foreground">They will join your workspace as Staff when they sign up with this email.</p>
        </form>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pending invitations</Label>
            {invites.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{i.email}</p>
                  <p className="text-xs text-muted-foreground">Waiting for signup</p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeInvite(i.id)}
                  aria-label="Revoke invitation"
                  className="text-muted-foreground hover:text-destructive p-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Staff list */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Staff accounts</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff yet. Invite someone above.</p>
          ) : (
            staff.map((row) => (
              <div key={row.user_id} className={`rounded-lg border p-4 space-y-3 ${row.is_active ? "" : "opacity-70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{row.full_name || row.email || "Staff member"}</p>
                      {!row.is_active && <Badge variant="secondary">Deactivated</Badge>}
                    </div>
                    {row.email && <p className="text-xs text-muted-foreground truncate">{row.email}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActive(row, !row.is_active)}
                    className={row.is_active ? "text-destructive hover:text-destructive" : ""}
                  >
                    {row.is_active ? (<><Ban className="h-4 w-4 mr-1" /> Deactivate</>) : (<><RotateCcw className="h-4 w-4 mr-1" /> Reactivate</>)}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODULES.map((m) => {
                    const key = `can_${m.key}` as keyof StaffRow;
                    const value = row[key] as boolean;
                    return (
                      <div key={m.key} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                        <span className="text-sm">{m.label}</span>
                        <Switch
                          checked={value}
                          disabled={!row.is_active || saving === row.user_id}
                          onCheckedChange={(next) => togglePerm(row, key, next)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StaffPermissionsCard;
