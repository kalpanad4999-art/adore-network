import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bot, Plus, Search, Pencil, Trash2, Download, Upload, MessageSquare, HelpCircle, Send, Loader2, Copy, ExternalLink, QrCode, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

const CATEGORIES = [
  "Membership", "Fees", "Yoga Classes", "Meditation", "Trainers",
  "Payments", "Renewals", "Attendance", "Gallery", "Contact", "Location", "General",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type KB = {
  id: string;
  owner_id: string;
  question: string;
  alternate_questions: string[];
  answer: string;
  category: string | null;
  keywords: string[];
  status: "active" | "disabled";
  updated_at: string;
};

type History = { id: string; phone: string | null; question: string; answer: string; created_at: string };
type Pending = { id: string; phone: string | null; question: string; resolved: boolean; created_at: string };

const emptyForm = {
  question: "",
  alt: "",
  answer: "",
  category: "",
  keywords: "",
  status: "active" as "active" | "disabled",
};

export const ChatbotKnowledgeCard = () => {
  const { ownerId, isOwner } = useStudio();
  const [items, setItems] = useState<KB[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KB | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Test chatbot
  const [testOpen, setTestOpen] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [testLog, setTestLog] = useState<{ role: "user" | "assistant"; content: string; source?: string }[]>([]);
  const [testSending, setTestSending] = useState(false);

  const load = async () => {
    if (!ownerId) return;
    setLoading(true);
    const [kbRes, hRes, pRes] = await Promise.all([
      supabase.from("chatbot_knowledge" as any).select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false }),
      supabase.from("chatbot_chat_history" as any).select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(200),
      supabase.from("chatbot_pending_questions" as any).select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(100),
    ]);
    setItems((kbRes.data as any) || []);
    setHistory((hRes.data as any) || []);
    setPending((pRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ownerId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter !== "all" && (i.category || "") !== categoryFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (!q) return true;
      return (
        i.question.toLowerCase().includes(q) ||
        i.answer.toLowerCase().includes(q) ||
        (i.alternate_questions || []).some((a) => a.toLowerCase().includes(q)) ||
        (i.keywords || []).some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [items, search, categoryFilter, statusFilter]);

  const openNew = (prefill?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, question: prefill || "" });
    setDialogOpen(true);
  };

  const openEdit = (kb: KB) => {
    setEditing(kb);
    setForm({
      question: kb.question,
      alt: (kb.alternate_questions || []).join("\n"),
      answer: kb.answer,
      category: kb.category || "",
      keywords: (kb.keywords || []).join(", "),
      status: kb.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!ownerId) return;
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("Question and Answer are required"); return;
    }
    setSaving(true);
    const payload = {
      owner_id: ownerId,
      question: form.question.trim(),
      alternate_questions: form.alt.split("\n").map((s) => s.trim()).filter(Boolean),
      answer: form.answer.trim(),
      category: form.category || null,
      keywords: form.keywords.split(",").map((s) => s.trim()).filter(Boolean),
      status: form.status,
    };
    const { error } = editing
      ? await supabase.from("chatbot_knowledge" as any).update(payload).eq("id", editing.id)
      : await supabase.from("chatbot_knowledge" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Added");
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("chatbot_knowledge" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const exportKB = (fmt: "json" | "csv") => {
    if (!items.length) return toast.error("Nothing to export");
    let blob: Blob;
    let name: string;
    if (fmt === "json") {
      blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
      name = "chatbot-knowledge.json";
    } else {
      const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["question", "alternate_questions", "answer", "category", "keywords", "status"],
        ...items.map((i) => [
          i.question,
          (i.alternate_questions || []).join(" | "),
          i.answer,
          i.category || "",
          (i.keywords || []).join(" | "),
          i.status,
        ]),
      ];
      blob = new Blob([rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\n")], { type: "text/csv" });
      name = "chatbot-knowledge.csv";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const importKB = async (file: File) => {
    if (!ownerId) return;
    const text = await file.text();
    let rows: any[] = [];
    try {
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [];
      } else {
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines.shift()!.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
        rows = lines.map((ln) => {
          const cells: string[] = [];
          let cur = ""; let inQ = false;
          for (let i = 0; i < ln.length; i++) {
            const c = ln[i];
            if (c === '"') { if (inQ && ln[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if (c === "," && !inQ) { cells.push(cur); cur = ""; }
            else cur += c;
          }
          cells.push(cur);
          const obj: any = {};
          headers.forEach((h, idx) => (obj[h] = cells[idx] ?? ""));
          return obj;
        });
      }
    } catch (e: any) { return toast.error("Invalid file: " + e.message); }

    const payload = rows
      .map((r) => ({
        owner_id: ownerId,
        question: String(r.question || "").trim(),
        answer: String(r.answer || "").trim(),
        alternate_questions: Array.isArray(r.alternate_questions)
          ? r.alternate_questions
          : String(r.alternate_questions || "").split("|").map((s: string) => s.trim()).filter(Boolean),
        keywords: Array.isArray(r.keywords)
          ? r.keywords
          : String(r.keywords || "").split("|").map((s: string) => s.trim()).filter(Boolean),
        category: r.category || null,
        status: r.status === "disabled" ? "disabled" : "active",
      }))
      .filter((r) => r.question && r.answer);

    if (!payload.length) return toast.error("No valid rows found");
    const { error } = await supabase.from("chatbot_knowledge" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${payload.length} entries`);
    load();
  };

  const clearHistory = async () => {
    if (!ownerId) return;
    const { error } = await supabase.from("chatbot_chat_history" as any).delete().eq("owner_id", ownerId);
    if (error) return toast.error(error.message);
    toast.success("History cleared"); load();
  };

  const deleteHistoryItem = async (id: string) => {
    await supabase.from("chatbot_chat_history" as any).delete().eq("id", id);
    load();
  };

  const resolvePending = async (p: Pending) => {
    openNew(p.question);
  };

  const dismissPending = async (id: string) => {
    await supabase.from("chatbot_pending_questions" as any).update({ resolved: true }).eq("id", id);
    load();
  };

  const sendTest = async () => {
    const text = testMsg.trim();
    if (!text || testSending || !ownerId) return;
    const next = [...testLog, { role: "user" as const, content: text }];
    setTestLog(next);
    setTestMsg("");
    setTestSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/support-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          ownerId, testMode: true,
        }),
      });
      const data = await res.json();
      setTestLog((l) => [...l, { role: "assistant", content: data.reply || data.error || "No response", source: data.source }]);
    } catch {
      setTestLog((l) => [...l, { role: "assistant", content: "Network error" }]);
    } finally { setTestSending(false); }
  };

  if (!isOwner) return null;

  const publicChatUrl = ownerId ? `${window.location.origin}/chat/${ownerId}` : "";
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const downloadQR = () => {
    const svg = qrWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatbot-qr.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const shareQR = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "AI Chatbot", text: "Chat with us", url: publicChatUrl });
      } else {
        await navigator.clipboard.writeText(publicChatUrl);
        toast.success("Link copied — share it anywhere");
      }
    } catch { /* user cancelled */ }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="font-display">AI Chatbot</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Train the chatbot with your own questions and answers. Changes take effect instantly.
            </CardDescription>
          </div>
          {publicChatUrl && (
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={publicChatUrl} className="h-9 w-52 text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicChatUrl); toast.success("Link copied"); }} title="Copy link">
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(publicChatUrl, "_blank")} title="Open link">
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQrOpen(true)} title="QR code">
                <QrCode className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={downloadQR} title="Download QR">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={shareQR} title="Share QR">
                <Share2 className="h-4 w-4" />
              </Button>
              <div ref={qrWrapRef} className="hidden">
                <QRCodeSVG value={publicChatUrl} size={240} />
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="kb" className="w-full">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
            <TabsTrigger value="pending">
              Pending {pending.filter((p) => !p.resolved).length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{pending.filter((p) => !p.resolved).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* KNOWLEDGE BASE */}
          <TabsContent value="kb" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search questions…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" /> Add Question</Button>
              <Button variant="outline" onClick={() => setTestOpen(true)}><MessageSquare className="h-4 w-4 mr-1" /> Test Chatbot</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Import</Button>
              <input ref={fileRef} type="file" accept=".json,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importKB(f); e.target.value = ""; }} />
              <Button variant="outline" onClick={() => exportKB("json")}><Download className="h-4 w-4 mr-1" /> JSON</Button>
              <Button variant="outline" onClick={() => exportKB("csv")}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No entries. Add your first question.</TableCell></TableRow>
                  ) : filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-[240px]">
                        <div className="font-medium truncate">{i.question}</div>
                        {i.alternate_questions?.length > 0 && (
                          <div className="text-xs text-muted-foreground truncate">+{i.alternate_questions.length} variant(s)</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{i.category ? <Badge variant="outline">{i.category}</Badge> : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={i.status === "active" ? "default" : "secondary"}>{i.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {new Date(i.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this Q&A?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(i.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* PENDING */}
          <TabsContent value="pending" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Questions your chatbot couldn't answer. Add answers to teach it.
            </p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="hidden sm:table-cell">Phone</TableHead>
                    <TableHead className="hidden md:table-cell">When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No pending questions.</TableCell></TableRow>
                  ) : pending.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[280px] truncate">{p.question}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.phone || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                      <TableCell>{p.resolved ? <Badge variant="secondary">Resolved</Badge> : <Badge>Open</Badge>}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => resolvePending(p)}>
                          <HelpCircle className="h-3.5 w-3.5 mr-1" /> Add Answer
                        </Button>
                        {!p.resolved && (
                          <Button variant="ghost" size="sm" onClick={() => dismissPending(p.id)}>Dismiss</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* HISTORY */}
          <TabsContent value="history" className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">Recent customer conversations.</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive" disabled={!history.length}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
                    <AlertDialogDescription>All stored conversations will be permanently removed.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearHistory}>Clear All</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {history.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">No conversations yet.</p>
              ) : history.map((h) => (
                <div key={h.id} className="rounded-md border p-3 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()}{h.phone ? ` • ${h.phone}` : ""}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteHistoryItem(h.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="text-sm"><span className="font-medium">Q:</span> {h.question}</div>
                  <div className="text-sm text-muted-foreground"><span className="font-medium text-foreground">A:</span> {h.answer}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add/Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Q&A" : "Add Question & Answer"}</DialogTitle>
              <DialogDescription>Rich answers support links, phone numbers, markdown-style bullets, and URLs to images/PDFs/videos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Question *</Label>
                <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="What are your yoga class timings?" />
              </div>
              <div className="space-y-1.5">
                <Label>Alternate Phrasings <span className="text-muted-foreground text-xs">(one per line)</span></Label>
                <Textarea rows={3} value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })}
                  placeholder="When do classes start?&#10;What time is yoga?" />
              </div>
              <div className="space-y-1.5">
                <Label>Answer *</Label>
                <Textarea rows={5} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  placeholder="Our classes run from 6:00 AM to 8:00 PM.&#10;• Morning: 6–9 AM&#10;• Evening: 5–8 PM&#10;WhatsApp: https://wa.me/91XXXXXXXXXX" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: "active" | "disabled") => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Keywords <span className="text-muted-foreground text-xs">(comma separated)</span></Label>
                <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="timing, schedule, hours" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test dialog */}
        <Dialog open={testOpen} onOpenChange={(o) => { setTestOpen(o); if (!o) setTestLog([]); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Test Chatbot</DialogTitle>
              <DialogDescription>Preview responses. Test messages are not saved to history.</DialogDescription>
            </DialogHeader>
            <div className="h-64 overflow-y-auto border rounded-md p-3 space-y-2 bg-muted/30">
              {testLog.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground pt-16">Type a question to test.</p>
              ) : testLog.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border"
                  }`}>
                    {m.content}
                    {m.source && <div className="text-[10px] mt-1 opacity-60">via {m.source}</div>}
                  </div>
                </div>
              ))}
              {testSending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendTest(); }} className="flex gap-2">
              <Input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} placeholder="Ask a question…" />
              <Button type="submit" size="icon" disabled={testSending || !testMsg.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Chatbot QR Code</DialogTitle>
              <DialogDescription>Scan to open the public chatbot. Always shows the current link.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-center bg-white p-4 rounded-lg">
              <QRCodeSVG value={publicChatUrl} size={240} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" variant="outline" onClick={downloadQR}><Download className="h-4 w-4 mr-2" />Download</Button>
              <Button className="flex-1" variant="outline" onClick={shareQR}><Share2 className="h-4 w-4 mr-2" />Share</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
