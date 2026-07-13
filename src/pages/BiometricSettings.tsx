import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, PlugZap, Unplug, RefreshCw, Trash2, Wifi, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Device = {
  id: string;
  device_name: string;
  device_identifier: string | null;
  ip_address: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  api_key: string | null;
  connection_type: "usb" | "lan" | "wifi" | "bluetooth";
  auto_sync: boolean;
  auto_sync_interval_minutes: number;
  is_active: boolean;
  last_status: "connected" | "disconnected" | "error";
  last_status_message: string | null;
  last_connected_at: string | null;
  last_synced_at: string | null;
};

const empty = (): Partial<Device> => ({
  device_name: "",
  device_identifier: "",
  ip_address: "",
  port: 4370,
  username: "",
  password: "",
  api_key: "",
  connection_type: "lan",
  auto_sync: false,
  auto_sync_interval_minutes: 15,
  is_active: true,
});

const BiometricSettings = () => {
  const { ownerId, isOwner, loading: studioLoading } = useStudio();
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState<Partial<Device>>(empty());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    const { data, error } = await supabase.from("biometric_devices" as any).select("*").eq("user_id", ownerId).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDevices(((data as any) || []) as Device[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [ownerId]);

  if (!studioLoading && !isOwner) return <Navigate to="/attendance" replace />;

  const resetForm = () => { setForm(empty()); setEditingId(null); };

  const save = async () => {
    if (!ownerId) return;
    if (!form.device_name?.trim()) { toast.error("Device name required"); return; }
    const payload: any = { ...form, user_id: ownerId };
    if (editingId) {
      const { error } = await supabase.from("biometric_devices" as any).update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Device updated");
    } else {
      const { error } = await supabase.from("biometric_devices" as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Device saved securely");
    }
    resetForm();
    load();
  };

  const edit = (d: Device) => { setForm(d); setEditingId(d.id); };

  const remove = async (id: string) => {
    if (!confirm("Delete this device?")) return;
    const { error } = await supabase.from("biometric_devices" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  // Simulated connectivity actions — ready for real SDK integration later.
  const updateStatus = async (id: string, patch: Partial<Device>) => {
    const { error } = await supabase.from("biometric_devices" as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    load();
  };

  const testConnection = async (d: Device) => {
    setBusy(d.id + ":test");
    await new Promise((r) => setTimeout(r, 900));
    const ok = !!d.ip_address || d.connection_type === "usb" || d.connection_type === "bluetooth";
    setBusy(null);
    if (ok) toast.success("Test successful — device is reachable (simulated)");
    else toast.error("Missing IP/host. Fill in connection details.");
  };

  const connect = async (d: Device) => {
    setBusy(d.id + ":conn");
    await new Promise((r) => setTimeout(r, 900));
    await updateStatus(d.id, {
      last_status: "connected",
      last_status_message: "Connected (simulated)",
      last_connected_at: new Date().toISOString(),
    });
    setBusy(null);
    toast.success("Connected");
  };

  const disconnect = async (d: Device) => {
    await updateStatus(d.id, { last_status: "disconnected", last_status_message: "Disconnected by user" });
    toast.success("Disconnected");
  };

  const syncNow = async (d: Device) => {
    setBusy(d.id + ":sync");
    await new Promise((r) => setTimeout(r, 1200));
    await updateStatus(d.id, { last_synced_at: new Date().toISOString() });
    setBusy(null);
    toast.success("Sync complete (simulated). Real SDK integration will push captured scans here.");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/attendance"><ArrowLeft className="h-4 w-4 mr-1" /> Attendance</Link></Button>
        <div>
          <h1 className="font-display text-3xl">Biometric Device</h1>
          <p className="text-sm text-muted-foreground">Configure fingerprint scanners. Credentials are stored securely and only visible to you.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{editingId ? "Edit device" : "Add device"}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Device name *"><Input value={form.device_name || ""} onChange={(e) => setForm({ ...form, device_name: e.target.value })} placeholder="Studio Entry Scanner" /></Field>
          <Field label="Device ID"><Input value={form.device_identifier || ""} onChange={(e) => setForm({ ...form, device_identifier: e.target.value })} placeholder="Serial / device ID" /></Field>
          <Field label="Connection type">
            <Select value={form.connection_type as string} onValueChange={(v) => setForm({ ...form, connection_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="usb">USB</SelectItem>
                <SelectItem value="lan">LAN</SelectItem>
                <SelectItem value="wifi">Wi-Fi</SelectItem>
                <SelectItem value="bluetooth">Bluetooth</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="IP address"><Input value={form.ip_address || ""} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.20" /></Field>
          <Field label="Port"><Input type="number" value={form.port ?? ""} onChange={(e) => setForm({ ...form, port: e.target.value ? parseInt(e.target.value) : null })} /></Field>
          <Field label="Username"><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" /></Field>
          <Field label="Password"><Input type="password" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></Field>
          <Field label="API / SDK key"><Input value={form.api_key || ""} onChange={(e) => setForm({ ...form, api_key: e.target.value })} autoComplete="off" /></Field>
          <Field label="Auto sync">
            <div className="flex items-center gap-3 h-10">
              <Switch checked={!!form.auto_sync} onCheckedChange={(v) => setForm({ ...form, auto_sync: v })} />
              <span className="text-sm text-muted-foreground">Every</span>
              <Input type="number" className="w-20" value={form.auto_sync_interval_minutes ?? 15} onChange={(e) => setForm({ ...form, auto_sync_interval_minutes: parseInt(e.target.value || "15") })} />
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </Field>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
            <Button onClick={save}>{editingId ? "Update" : "Save device"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Devices</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices configured yet.</p>
          ) : (
            <div className="space-y-3">
              {devices.map((d) => (
                <div key={d.id} className="border border-border rounded-lg p-3 flex flex-wrap gap-3 items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{d.device_name}</p>
                      <Badge variant={d.last_status === "connected" ? "secondary" : d.last_status === "error" ? "destructive" : "outline"} className="gap-1">
                        <Wifi className="h-3 w-3" /> {d.last_status}
                      </Badge>
                      <Badge variant="outline">{d.connection_type.toUpperCase()}</Badge>
                      {d.auto_sync && <Badge variant="outline">Auto-sync {d.auto_sync_interval_minutes}m</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.ip_address ? `${d.ip_address}${d.port ? `:${d.port}` : ""}` : "—"}
                      {d.last_status_message ? ` • ${d.last_status_message}` : ""}
                      {d.last_synced_at ? ` • Last sync: ${new Date(d.last_synced_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => testConnection(d)} disabled={busy === d.id + ":test"}>
                      {busy === d.id + ":test" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                    </Button>
                    {d.last_status !== "connected" ? (
                      <Button size="sm" onClick={() => connect(d)} disabled={busy === d.id + ":conn"}>
                        {busy === d.id + ":conn" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><PlugZap className="h-4 w-4 mr-1" />Connect</>}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => disconnect(d)}><Unplug className="h-4 w-4 mr-1" />Disconnect</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => syncNow(d)} disabled={busy === d.id + ":sync"}>
                      {busy === d.id + ":sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Sync</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => edit(d)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Ready for SDK integration: connect/sync actions currently simulate a device. Wire your device SDK (ZKTeco, Mantra, etc.) into the Connect / Sync handlers to enable live capture — attendance records support a <code>device_sync</code> method and offline queueing already.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    {children}
  </div>
);

export default BiometricSettings;
