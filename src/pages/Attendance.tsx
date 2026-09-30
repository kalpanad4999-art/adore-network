import { useEffect, useMemo, useState } from "react";
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
import { Camera, ImagePlus, CheckCircle2, Search, Download, Printer, Loader2, Trash2, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { photoRecognitionService, uniqueBatchMatches } from "@/lib/photoAttendance";
import PhotoCameraDialog from "@/components/PhotoCameraDialog";
import { fmtDate, fmtDateTime } from "@/lib/date";

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
type Student = { id: string; name: string; batch_id: string | null; email: string | null; phone: string | null; photo_path: string | null };
type AttendanceRow = {
  id: string;
  batch_id: string;
  student_id: string;
  attendance_date: string;
  marked_at: string;
  status: "present" | "absent";
  method: string;
};

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const OFFLINE_KEY = "attendance_offline_queue_v1";

const readQueue = (): any[] => {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]"); } catch { return []; }
};
const writeQueue = (rows: any[]) => localStorage.setItem(OFFLINE_KEY, JSON.stringify(rows));

const Attendance = () => {
  const { user } = useAuth();
  const { ownerId, isOwner } = useStudio();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [manualOpen, setManualOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "photo">("manual");
  const [photoStep, setPhotoStep] = useState<1 | 2 | 3>(1);
  const [photoDate, setPhotoDate] = useState(today());
  const [photoDateText, setPhotoDateText] = useState(fmtDate(today()));
  const [groupPhotos, setGroupPhotos] = useState<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizedIds, setRecognizedIds] = useState<string[]>([]);
  const [matchConfidence, setMatchConfidence] = useState<Record<string, number>>({});
  const [unknownFaces, setUnknownFaces] = useState(0);
  const [recognitionSucceeded, setRecognitionSucceeded] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "present" | "absent">>({});
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterDate, setFilterDate] = useState(today());
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [queueCount, setQueueCount] = useState(readQueue().length);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteSettingsOpen, setDeleteSettingsOpen] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState<AutoDeleteDays>(readAutoDeleteDays());

  const loadData = async () => {
    if (!ownerId) return;
    setLoading(true);
    // Auto-delete sweep — removes only attendance records older than the configured window.
    const days = readAutoDeleteDays();
    if (days > 0) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      await supabase.from("attendance" as any).delete().eq("user_id", ownerId).lt("attendance_date", cutoff);
    }
    const [b, s, a] = await Promise.all([
      supabase.from("batches").select("id,name").eq("user_id", ownerId).order("name"),
      supabase.from("students").select("id,name,batch_id,email,phone,photo_path").eq("user_id", ownerId).order("name"),
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

  const markPresent = async (studentId: string, method: "manual") => {
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

  const resetPhoto = () => {
    setPhotoStep(1); setGroupPhotos([]); setDecisions({}); setRecognizedIds([]); setMatchConfidence({}); setUnknownFaces(0); setRecognitionSucceeded(false);
  };
  const addPhotos = (files: File[] | FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (accepted.length !== files.length) toast.error("Use JPG, PNG or WEBP photos under 5 MB each");
    if (groupPhotos.length + accepted.length > 10) toast.error("You can add up to 10 photos");
    setGroupPhotos((prev) => [...prev, ...accepted].slice(0, 10));
  };
  const beginReview = async () => {
    if (!groupPhotos.length) { toast.error("Add at least one batch photo"); return; }
    setRecognizing(true);
    try {
      const result = uniqueBatchMatches(await photoRecognitionService.recognize({
        batchId: selectedBatch, date: photoDate, photos: groupPhotos, memberIds: studentsInBatch.map((s) => s.id),
      }), studentsInBatch.map((s) => s.id));
      if (result.available === false) {
        setRecognizedIds([]); setMatchConfidence({}); setUnknownFaces(0); setDecisions({});
        setRecognitionSucceeded(false);
        toast.info(result.unavailableReason || "Recognition unavailable. Review attendance manually.");
        return;
      }
      setRecognizedIds(result.recognizedIds);
      setMatchConfidence(Object.fromEntries((result.matches ?? []).map((m) => [m.memberId, m.similarity])));
      setRecognitionSucceeded(true);
      setUnknownFaces(result.unknownFaces);
      setDecisions(Object.fromEntries(result.recognizedIds.map((id) => [id, "present"])));
    } catch (err: any) {
      setRecognizedIds([]); setMatchConfidence({}); setUnknownFaces(0); setDecisions({});
      setRecognitionSucceeded(false);
      toast.error(err?.message || "Recognition unavailable. Review manually.");
    } finally {
      setRecognizing(false); setPhotoStep(3);
    }
  };
  const submitPhotoAttendance = async () => {
    if (!ownerId || !selectedBatch || Object.keys(decisions).length !== studentsInBatch.length) return;
    setSubmitting(true);
    try {
      const { data: existing, error: checkError } = await supabase.from("attendance").select("student_id").eq("user_id", ownerId).eq("batch_id", selectedBatch).eq("attendance_date", photoDate);
      if (checkError) throw checkError;
      if (existing?.length) throw new Error("Attendance already exists for this batch and date. No duplicate records were created.");
      const rows = studentsInBatch.map((s) => ({ user_id: ownerId, batch_id: selectedBatch, student_id: s.id, attendance_date: photoDate, status: decisions[s.id], method: recognitionSucceeded ? "ai_photo" : "manual", marked_by: user?.id ?? null }));
      const { error } = await supabase.from("attendance").insert(rows);
      if (error) throw error;
      toast.success("Attendance submitted"); setSubmitOpen(false); resetPhoto(); await loadData();
    } catch (err: any) {
      toast.error(err?.code === "23505" ? "Attendance already exists for this date" : err?.message || "Could not submit attendance");
    } finally { setSubmitting(false); }
  };

  // Dashboard stats for filterDate + filterBatch
  const stats = useMemo(() => {
    const dateRecs = records.filter((r) => r.attendance_date === filterDate && (filterBatch === "all" || r.batch_id === filterBatch));
    const roster = students.filter((s) => filterBatch === "all" ? s.batch_id : s.batch_id === filterBatch);
    const presentIds = new Set(dateRecs.filter((r) => r.status === "present").map((r) => r.student_id));
    const total = roster.length;
    const present = roster.filter((s) => presentIds.has(s.id)).length;
    const absent = roster.filter((s) => dateRecs.some((r) => r.student_id === s.id && r.status === "absent")).length;
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
      return [fmtDate(r.attendance_date), b?.name ?? "", s?.name ?? "", r.status, r.method, fmtDateTime(r.marked_at)];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `attendance-${filterDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !ownerId) return;
    setDeleting(true);
    const { error } = await supabase.from("attendance" as any).delete().eq("id", deleteTarget.id).eq("user_id", ownerId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Attendance record deleted");
    setDeleteTarget(null);
    loadData();
  };

  const saveAutoDelete = (v: AutoDeleteDays) => {
    setAutoDeleteDays(v);
    localStorage.setItem(AUTO_DELETE_KEY, String(v));
    toast.success(v === 0 ? "Auto delete disabled" : `Auto delete set to ${AUTO_DELETE_OPTIONS.find((o) => o.value === v)?.label}`);
  };

  const batchName = batches.find((b) => b.id === selectedBatch)?.name || "selected batch";
  const alreadySubmitted = records.some((r) => r.batch_id === selectedBatch && r.attendance_date === photoDate);
  const unresolved = studentsInBatch.filter((s) => !decisions[s.id]).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark and track attendance batch-wise.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {queueCount > 0 && <Badge variant="secondary">{queueCount} queued (offline)</Badge>}
          {isOwner && autoDeleteDays > 0 && (
            <Badge variant="outline">Auto delete: {AUTO_DELETE_OPTIONS.find((o) => o.value === autoDeleteDays)?.label}</Badge>
          )}
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setDeleteSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" /> Delete Settings
            </Button>
          )}
        </div>
      </div>


      <Tabs defaultValue="mark" className="w-full min-w-0">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="reports">Reports & History</TabsTrigger>
        </TabsList>

        {/* MARK ---------------------------------------------------------- */}
        <TabsContent value="mark" className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Attendance method">
            <Button className="h-auto min-h-10 whitespace-normal px-2 text-center" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Manual Attendance</Button>
            <Button className="h-auto min-h-10 whitespace-normal px-2 text-center" variant={mode === "photo" ? "default" : "outline"} onClick={() => setMode("photo")}><Camera className="mr-1 h-4 w-4 shrink-0" />AI Photo Attendance</Button>
          </div>
          <Card>
            <CardHeader><CardTitle>Select Batch</CardTitle></CardHeader>
            <CardContent className="space-y-3">
               <Select value={selectedBatch} onValueChange={(v) => { setSelectedBatch(v); resetPhoto(); }}>
                <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {mode === "photo" && <div className="max-w-xs space-y-1"><Label htmlFor="photo-date">Date (DD/MM/YYYY)</Label><Input id="photo-date" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} value={photoDateText} onChange={(e) => { const text = e.target.value; setPhotoDateText(text); const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text); const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null; setPhotoDate(d && fmtDate(d) === text ? `${m?.[3]}-${m?.[2]}-${m?.[1]}` : ""); resetPhoto(); }} /></div>}
              {selectedBatch && (
                <p className="text-xs text-muted-foreground">
                  {studentsInBatch.length} member(s) in this batch{mode === "photo" && ` · ${studentsInBatch.filter((s) => s.photo_path).length} with photos`}
                </p>
              )}
              {mode === "photo" && selectedBatch && photoStep === 1 && <Button disabled={!studentsInBatch.length || !photoDate || alreadySubmitted} onClick={() => setPhotoStep(2)}>Continue</Button>}
              {mode === "photo" && alreadySubmitted && <p role="alert" className="text-sm text-destructive">Attendance already submitted for this batch and date.</p>}
            </CardContent>
          </Card>

          {mode === "photo" && selectedBatch && photoStep >= 2 && <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{["Select Batch", "Capture Photos", "Review Attendance", "Confirm & Submit"].map((s, i) => <span key={s} className={photoStep >= Math.min(i + 1, 3) ? "text-foreground" : ""}>{i > 0 && "  →  "}{s}</span>)}</p>
            {photoStep === 2 && <Card><CardHeader><CardTitle>Capture Batch Photos</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                 <Button type="button" variant="outline" onClick={() => setCameraOpen(true)}><Camera className="mr-2 h-4 w-4" />Open Camera</Button>
                 <Button asChild variant="outline"><label className="cursor-pointer"><ImagePlus className="mr-2 h-4 w-4" />Upload Photos<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} /></label></Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{groupPhotos.map((file, i) => <PhotoThumbnail key={`${file.name}-${i}`} file={file} onRemove={() => setGroupPhotos((p) => p.filter((_, n) => n !== i))} />)}</div>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setPhotoStep(1)}>Back</Button><Button onClick={beginReview} disabled={!groupPhotos.length || recognizing || alreadySubmitted}>{recognizing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Recognize Faces</Button></div>
            </CardContent></Card>}
            {photoStep === 3 && <Card><CardHeader><CardTitle>Review Attendance · {batchName} · {fmtDate(photoDate)}</CardTitle></CardHeader><CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{recognitionSucceeded ? `${recognizedIds.length} recognized · ${studentsInBatch.length - recognizedIds.length} not detected. Not detected does not mean absent.` : "Recognition unavailable · No members were identified. Review the photos and decide each member’s status manually."}</p>
               <div className="space-y-2">{studentsInBatch.map((s) => <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"><div><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{recognizedIds.includes(s.id) ? `Recognized · ${matchConfidence[s.id] ?? 0}% similarity` : recognitionSucceeded ? "Not detected · Could be outside the photo, obscured, poorly lit, turned away, too small, unrecognized, or absent" : "Needs review"}{!s.photo_path && " · No reference photo"}</p></div><div className="flex gap-1"><Button size="sm" variant={decisions[s.id] === "present" ? "default" : "outline"} onClick={() => setDecisions((d) => ({ ...d, [s.id]: "present" }))}>Present</Button><Button size="sm" variant={decisions[s.id] === "absent" ? "default" : "outline"} onClick={() => setDecisions((d) => ({ ...d, [s.id]: "absent" }))}>Absent</Button></div></div>)}</div>
              {unknownFaces > 0 && <div className="text-sm text-muted-foreground">{Array.from({ length: unknownFaces }, (_, i) => <p key={i}>? Face {i + 1} · Unknown <Button size="sm" variant="ghost" onClick={() => setUnknownFaces((n) => n - 1)}>Ignore</Button><Button size="sm" variant="ghost" onClick={() => setPhotoStep(2)}>Review photos</Button></p>)}</div>}
              <div className="border-t border-border pt-3 text-sm">Total {studentsInBatch.length} · Present {Object.values(decisions).filter((v) => v === "present").length} · Absent {Object.values(decisions).filter((v) => v === "absent").length} · Needs review {unresolved}</div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setPhotoStep(2)}>Back to photos</Button><Button disabled={unresolved > 0 || !studentsInBatch.length || alreadySubmitted} onClick={() => setSubmitOpen(true)}>Submit Attendance</Button></div>
            </CardContent></Card>}
          </div>}

          {mode === "manual" && selectedBatch && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Members</CardTitle>
                  {(
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
                             <Button size="sm" onClick={() => { setSelectedStudent(s.id); setManualOpen(true); }}>
                               Mark Present
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
                    {isOwner && <th className="py-2 pr-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.slice(0, 500).map((r) => {
                    const s = students.find((x) => x.id === r.student_id);
                    const b = batches.find((x) => x.id === r.batch_id);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2 pr-3">{fmtDate(r.attendance_date)}</td>
                        <td className="py-2 pr-3">{s?.name ?? "—"}</td>
                        <td className="py-2 pr-3">{b?.name ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={r.status === "present" ? "secondary" : "outline"}>{r.status}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">{r.method === "ai_photo" ? "AI Photo" : r.method === "manual" ? "Manual" : r.method}</td>
                        <td className="py-2 pr-3 text-xs">{fmtDateTime(r.marked_at)}</td>
                        {isOwner && (
                          <td className="py-2 pr-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(r)} aria-label="Delete attendance">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && !loading && (
                    <tr><td colSpan={isOwner ? 7 : 6} className="py-6 text-center text-muted-foreground">No records.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PhotoCameraDialog open={cameraOpen} onOpenChange={setCameraOpen} title="Capture Batch Photo" onUsePhoto={(photo) => addPhotos([photo])} />

      {/* Manual mark dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manual attendance</DialogTitle>
            <DialogDescription>Select a member to mark present.</DialogDescription>
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

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Submit attendance for {batchName}?</AlertDialogTitle><AlertDialogDescription>{fmtDate(photoDate)} · {Object.values(decisions).filter((v) => v === "present").length} present · {Object.values(decisions).filter((v) => v === "absent").length} absent. Only confirmed decisions will be saved.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel><Button disabled={submitting} onClick={submitPhotoAttendance}>{submitting ? "Submitting…" : "Confirm & Submit"}</Button></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Manual delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attendance record? This action cannot be undone.
              {deleteTarget && (
                <span className="block mt-2 text-foreground">
                  {students.find((s) => s.id === deleteTarget.student_id)?.name ?? "Member"} · {fmtDate(deleteTarget.attendance_date)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto delete settings */}
      <Dialog open={deleteSettingsOpen} onOpenChange={setDeleteSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Attendance Settings</DialogTitle>
            <DialogDescription>
              Auto delete removes only attendance records older than the selected period. Member details are never affected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Auto delete period</Label>
            <Select value={String(autoDeleteDays)} onValueChange={(v) => saveAutoDelete(Number(v) as AutoDeleteDays)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUTO_DELETE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={() => setDeleteSettingsOpen(false)}>Done</Button>
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

const PhotoThumbnail = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const [url, setUrl] = useState("");
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next); }, [file]);
  return <div className="relative"><img src={url} alt={file.name} className="aspect-square w-full rounded-md border border-border object-cover" /><Button aria-label={`Remove ${file.name}`} title="Remove photo" type="button" variant="secondary" size="icon" className="absolute right-1 top-1 h-8 w-8" onClick={onRemove}><X className="h-4 w-4" /></Button></div>;
};
