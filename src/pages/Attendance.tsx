import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fingerprint, CheckCircle2, XCircle, Search, Download, Printer, Cog, Loader2, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { verifyBiometric } from "@/lib/biometric";

const AUTO_DELETE_KEY = "attendance_auto_delete_days_v1";
type AutoDeleteDays = 0 | 30 | 60 | 90 | 180 | 365;
const AUTO_DELETE_OPTIONS: { value: AutoDeleteDays; label: string }[] = [
  { value: 0, label: "Never" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "1 year" },
];
const readAutoDeleteDays = (): AutoDeleteDays => {
  const n = Number(localStorage.getItem(AUTO_DELETE_KEY) || 0);
  return (AUTO_DELETE_OPTIONS.find((o) => o.value === n)?.value ?? 0) as AutoDeleteDays;
};

type Batch = { id: string; name: string };
type Student = { id: string; name: string; batch_id: string | null; email: string | null; phone: string | null };
type AttendanceRow = {
  id: string;
  batch_id: string;
  student_id: string;
  attendance_date: string;
  marked_at: string;
  status: "present" | "absent";
  method: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const OFFLINE_KEY = "attendance_offline_queue_v1";

const readQueue = (): any[] => {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]"); } catch { return []; }
};
const writeQueue = (rows: any[]) => localStorage.setItem(OFFLINE_KEY, JSON.stringify(rows));

const Attendance = () => {
  const { user } = useAuth();
  const { ownerId, isOwner, biometricEnabled, biometricCredentialId } = useStudio();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [queueCount, setQueueCount] = useState(readQueue().length);

  const loadData = async () => {
    if (!ownerId) return;
    setLoading(true);
    const [b, s, a] = await Promise.all([
      supabase.from("batches").select("id,name").eq("user_id", ownerId).order("name"),
      supabase.from("students").select("id,name,batch_id,email,phone").eq("user_id", ownerId).order("name"),
      supabase.from("attendance" as any).select("*").eq("user_id", ownerId).order("marked_at", { ascending: false }).limit(2000),
    ]);
    setBatches((b.data || []) as Batch[]);
    setStudents((s.data || []) as Student[]);
    setRecords(((a.data as any) || []) as AttendanceRow[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [ownerId]);

  // Flush offline queue when online
  const flushQueue = async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine || !ownerId) return;
    const remaining: any[] = [];
    for (const row of q) {
      const { error } = await supabase.from("attendance" as any).insert(row);
      if (error && !error.message.includes("duplicate")) remaining.push(row);
    }
    writeQueue(remaining);
    setQueueCount(remaining.length);
    if (q.length !== remaining.length) {
      toast.success(`Synced ${q.length - remaining.length} offline attendance record(s)`);
      loadData();
    }
  };

  useEffect(() => {
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    flushQueue();
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  const studentsInBatch = useMemo(
    () => students.filter((s) => s.batch_id === selectedBatch),
    [students, selectedBatch]
  );

  const markPresent = async (studentId: string, method: "biometric_sim" | "manual") => {
    if (!ownerId || !selectedBatch) return;
    const row = {
      user_id: ownerId,
      batch_id: selectedBatch,
      student_id: studentId,
      attendance_date: today(),
      marked_at: new Date().toISOString(),
      status: "present" as const,
      method,
      marked_by: user?.id ?? null,
    };
    if (!navigator.onLine) {
      const q = readQueue(); q.push(row); writeQueue(q); setQueueCount(q.length);
      toast.success("Offline — queued. Will sync when reconnected.");
      return;
    }
    const { error } = await supabase.from("attendance" as any).insert(row);
    if (error) {
      if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
        toast.error("Already marked present today");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Marked Present");
    loadData();
  };

  const openVerify = (studentId: string) => {
    if (!selectedBatch) { toast.error("Select a batch first"); return; }
    setSelectedStudent(studentId);
    setVerifyOpen(true);
  };

  const runVerification = async () => {
    setVerifying(true);
    try {
      // Simulated biometric verify. If owner has WebAuthn credential registered,
      // use device biometric for real; otherwise fall back to simulated success.
      let ok = true;
      if (biometricEnabled && biometricCredentialId) {
        ok = await verifyBiometric(biometricCredentialId);
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }
      if (!ok) { toast.error("Fingerprint verification failed"); return; }
      await markPresent(selectedStudent, "biometric_sim");
      setVerifyOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Verification error");
    } finally {
      setVerifying(false);
    }
  };

  // Dashboard stats for filterDate + filterBatch
  const stats = useMemo(() => {
    const dateRecs = records.filter((r) => r.attendance_date === filterDate && (filterBatch === "all" || r.batch_id === filterBatch));
    const roster = students.filter((s) => filterBatch === "all" ? s.batch_id : s.batch_id === filterBatch);
    const presentIds = new Set(dateRecs.filter((r) => r.status === "present").map((r) => r.student_id));
    const total = roster.length;
    const present = roster.filter((s) => presentIds.has(s.id)).length;
    const absent = Math.max(total - present, 0);
    const pct = total ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, pct };
  }, [records, students, filterDate, filterBatch]);

  // Historical rows for table + charts
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filterBatch !== "all" && r.batch_id !== filterBatch) return false;
      const s = students.find((x) => x.id === r.student_id);
      if (search && !s?.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, students, filterBatch, search]);

  // Weekly / Monthly aggregation
  const seriesDaily = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRecords) {
      if (r.status !== "present") continue;
      map.set(r.attendance_date, (map.get(r.attendance_date) || 0) + 1);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  }, [filteredRecords]);

  const exportCsv = () => {
    const header = ["Date", "Batch", "Member", "Status", "Method", "Marked At"];
    const rows = filteredRecords.map((r) => {
      const s = students.find((x) => x.id === r.student_id);
      const b = batches.find((x) => x.id === r.batch_id);
      return [r.attendance_date, b?.name ?? "", s?.name ?? "", r.status, r.method, new Date(r.marked_at).toLocaleString()];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${filterDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedStudentObj = students.find((s) => s.id === selectedStudent);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark and track attendance batch-wise. Fingerprint-ready.</p>
        </div>
        <div className="flex items-center gap-2">
          {queueCount > 0 && <Badge variant="secondary">{queueCount} queued (offline)</Badge>}
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/biometric"><Cog className="h-4 w-4 mr-2" /> Biometric Device</Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="mark" className="w-full">
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="reports">Reports & History</TabsTrigger>
        </TabsList>

        {/* MARK ---------------------------------------------------------- */}
        <TabsContent value="mark" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Select Batch</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedBatch && (
                <p className="text-xs text-muted-foreground">
                  {studentsInBatch.length} student(s) in this batch
                </p>
              )}
            </CardContent>
          </Card>

          {selectedBatch && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Members</CardTitle>
                {isOwner && (
                  <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
                    Manual Mark
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {studentsInBatch.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No students in this batch.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {studentsInBatch.map((s) => {
                      const marked = records.some((r) => r.student_id === s.id && r.attendance_date === today() && r.status === "present");
                      return (
                        <div key={s.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.phone || s.email || "—"}</p>
                          </div>
                          {marked ? (
                            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Present</Badge>
                          ) : (
                            <Button size="sm" onClick={() => openVerify(s.id)}>
                              <Fingerprint className="h-4 w-4 mr-1" /> Verify
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DASHBOARD ----------------------------------------------------- */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px]">
                <Label>Date</Label>
                <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label>Batch</Label>
                <Select value={filterBatch} onValueChange={setFilterBatch}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All batches</SelectItem>
                    {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Strength" value={stats.total} />
            <StatCard label="Present" value={stats.present} accent="text-emerald-600" />
            <StatCard label="Absent" value={stats.absent} accent="text-destructive" />
            <StatCard label="Attendance %" value={`${stats.pct}%`} accent="text-primary" />
          </div>

          <Card>
            <CardHeader><CardTitle>Last 30 days (Present per day)</CardTitle></CardHeader>
            <CardContent>
              {seriesDaily.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {seriesDaily.map(([d, n]) => {
                    const max = Math.max(...seriesDaily.map(([, v]) => v), 1);
                    return (
                      <div key={d} className="flex-1 flex flex-col items-center gap-1" title={`${d}: ${n}`}>
                        <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(n / max) * 100}%` }} />
                        <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">{d.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS ------------------------------------------------------- */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label>Search student</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name…" />
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label>Batch</Label>
                <Select value={filterBatch} onValueChange={setFilterBatch}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All batches</SelectItem>
                    {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print / PDF</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Records</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Member</th>
                    <th className="py-2 pr-3">Batch</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Marked at</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.slice(0, 500).map((r) => {
                    const s = students.find((x) => x.id === r.student_id);
                    const b = batches.find((x) => x.id === r.batch_id);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 pr-3">{r.attendance_date}</td>
                        <td className="py-2 pr-3">{s?.name ?? "—"}</td>
                        <td className="py-2 pr-3">{b?.name ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={r.status === "present" ? "secondary" : "outline"}>{r.status}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{r.method}</td>
                        <td className="py-2 pr-3 text-xs">{new Date(r.marked_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && !loading && (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No records.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Verify fingerprint dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify fingerprint</DialogTitle>
            <DialogDescription>
              {selectedStudentObj?.name ?? "Member"} — place finger on the connected device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 gap-3">
            <div className={`h-24 w-24 rounded-full flex items-center justify-center border-2 ${verifying ? "border-primary animate-pulse" : "border-border"}`}>
              {verifying ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <Fingerprint className="h-12 w-12 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {biometricEnabled ? "Uses your device biometric." : "Simulated verification (no physical device connected)."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)} disabled={verifying}>Cancel</Button>
            <Button onClick={runVerification} disabled={verifying}>
              {verifying ? "Verifying…" : "Verify & Mark Present"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual mark dialog (owner only) */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manual attendance</DialogTitle>
            <DialogDescription>Owner override — mark a student present without fingerprint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Member</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
              <SelectContent>
                {studentsInBatch.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button onClick={async () => { if (selectedStudent) { await markPresent(selectedStudent, "manual"); setManualOpen(false); } }}>
              Mark Present
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-3xl mt-1 ${accent ?? ""}`}>{value}</p>
    </CardContent>
  </Card>
);

export default Attendance;
