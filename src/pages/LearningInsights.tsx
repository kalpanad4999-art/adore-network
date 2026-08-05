import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, FileText, Sparkles, Plus, Trash2, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import InsightsReportDialog, { InsightsReportData, ReportSections } from "@/components/InsightsReportDialog";

interface Member { id: string; name: string; phone: string | null; email: string | null; batch_id: string | null }
interface Batch { id: string; name: string }
export interface InsightField { id: string; name: string; unit: string | null; sort_order: number }

export interface Measures {
  initial_height: string; present_height: string;
  initial_weight: string; present_weight: string;
  initial_flexibility: string; present_flexibility: string;
  insights: string; custom_notes: string;
  custom: Record<string, { i: string; p: string }>;
}

const emptyMeasures = (): Measures => ({
  initial_height: "", present_height: "",
  initial_weight: "", present_weight: "",
  initial_flexibility: "", present_flexibility: "",
  insights: "", custom_notes: "", custom: {},
});

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export const compare = (a: string, b: string, unit: string) => {
  const x = num(a); const y = num(b);
  if (x === null || y === null || isNaN(x) || isNaN(y)) return "—";
  const d = Math.round((y - x) * 100) / 100;
  if (d === 0) return "No change";
  const sign = d > 0 ? "+" : "";
  const word = unit === "kg" ? (d < 0 ? "Reduced" : "Gained") : d > 0 ? "Improved" : "Declined";
  return `${sign}${d}${unit} (${word})`;
};

export const autoInsight = (m: Measures, name: string, fields: InsightField[] = []) => {
  const parts: string[] = [];
  const h = compare(m.initial_height, m.present_height, " cm");
  const w = compare(m.initial_weight, m.present_weight, " kg");
  const f = compare(m.initial_flexibility, m.present_flexibility, "%");
  if (h !== "—") parts.push(`Height: ${h}.`);
  if (w !== "—") parts.push(`Weight: ${w}.`);
  if (f !== "—") parts.push(`Flexibility / Speed: ${f}.`);
  fields.forEach((fl) => {
    const v = m.custom?.[fl.id];
    if (!v) return;
    const c = compare(v.i ?? "", v.p ?? "", fl.unit ? ` ${fl.unit}` : "");
    if (c !== "—") parts.push(`${fl.name}: ${c}.`);
  });
  if (!parts.length) return `${name} has no recorded measurements yet.`;
  return `${name} has shown measurable progress through consistent practice. ${parts.join(" ")} Continue regular attendance and guided practice to sustain this improvement.`;
};

const defaultSections: ReportSections = {
  memberDetails: true, height: true, weight: true, flexibility: true,
  customFields: true, insights: true, notes: true, date: true,
};

const LearningInsights = () => {
  const { user } = useAuth();
  const { ownerId } = useStudio();
  const workspaceId = ownerId ?? user?.id ?? null;

  const [batches, setBatches] = useState<Batch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState("");
  const [allMembers, setAllMembers] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Record<string, Measures>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sections, setSections] = useState<ReportSections>(defaultSections);
  const [report, setReport] = useState<InsightsReportData | null>(null);

  // Dynamic comparison fields
  const [fields, setFields] = useState<InsightField[]>([]);
  const [newField, setNewField] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [addingField, setAddingField] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");

  const toMeasures = (r: any): Measures => ({
    initial_height: r.initial_height?.toString() ?? "",
    present_height: r.present_height?.toString() ?? "",
    initial_weight: r.initial_weight?.toString() ?? "",
    present_weight: r.present_weight?.toString() ?? "",
    initial_flexibility: r.initial_flexibility?.toString() ?? "",
    present_flexibility: r.present_flexibility?.toString() ?? "",
    insights: r.insights ?? "",
    custom_notes: r.custom_notes ?? "",
    custom: (r.custom_measures as Record<string, { i: string; p: string }>) ?? {},
  });

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      setLoading(true);
      const [b, m, li, fl] = await Promise.all([
        supabase.from("batches").select("id,name").eq("user_id", workspaceId).order("name"),
        supabase.from("students").select("id,name,phone,email,batch_id").eq("user_id", workspaceId).order("name"),
        supabase.from("learning_insights").select("*").eq("user_id", workspaceId),
        supabase.from("insight_fields").select("id,name,unit,sort_order").eq("user_id", workspaceId).order("sort_order").order("created_at"),
      ]);
      setBatches((b.data as Batch[]) || []);
      setMembers((m.data as Member[]) || []);
      const map: Record<string, Measures> = {};
      (li.data || []).forEach((r: any) => { map[r.student_id] = toMeasures(r); });
      setData(map);
      setFields((fl.data as InsightField[]) || []);
      setLoading(false);
    })();
  }, [workspaceId]);

  const batchMembers = useMemo(
    () => members.filter((m) => m.batch_id === batchId),
    [members, batchId]
  );

  const searchedMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? batchMembers.filter((m) => m.name.toLowerCase().includes(q)) : batchMembers;
  }, [batchMembers, search]);

  const targetMembers = useMemo(
    () => (allMembers ? batchMembers : batchMembers.filter((m) => selected.includes(m.id))),
    [allMembers, batchMembers, selected]
  );

  const get = (id: string) => data[id] ?? emptyMeasures();
  const set = (id: string, patch: Partial<Measures>) =>
    setData((d) => ({ ...d, [id]: { ...get(id), ...patch } }));
  const setCustom = (id: string, fieldId: string, which: "i" | "p", value: string) => {
    const cur = get(id);
    const entry = cur.custom?.[fieldId] ?? { i: "", p: "" };
    set(id, { custom: { ...(cur.custom || {}), [fieldId]: { ...entry, [which]: value } } });
  };

  const addField = async () => {
    const name = newField.trim();
    if (!workspaceId || !name) return;
    if (fields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error("That comparison field already exists."); return;
    }
    setAddingField(true);
    const { data: row, error } = await supabase.from("insight_fields").insert({
      user_id: workspaceId, name, unit: newUnit.trim() || null, sort_order: fields.length,
    }).select("id,name,unit,sort_order").single();
    setAddingField(false);
    if (error || !row) { toast.error(error?.message ?? "Could not add field"); return; }
    setFields((f) => [...f, row as InsightField]);
    setNewField(""); setNewUnit("");
    toast.success(`Added “Initial ${name}” and “Present ${name}”`);
  };

  const saveFieldEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase.from("insight_fields").update({ name, unit: editUnit.trim() || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFields((f) => f.map((x) => (x.id === id ? { ...x, name, unit: editUnit.trim() || null } : x)));
    setEditId(null);
    toast.success("Field updated");
  };

  const removeField = async (f: InsightField) => {
    const { error } = await supabase.from("insight_fields").delete().eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    setFields((list) => list.filter((x) => x.id !== f.id));
    toast.success(`Removed ${f.name}`);
  };

  const save = async (m: Member) => {
    if (!workspaceId) return;
    setSaving(m.id);
    const v = get(m.id);
    const { error } = await supabase.from("learning_insights").upsert(
      {
        user_id: workspaceId,
        student_id: m.id,
        batch_id: m.batch_id,
        initial_height: num(v.initial_height),
        present_height: num(v.present_height),
        initial_weight: num(v.initial_weight),
        present_weight: num(v.present_weight),
        initial_flexibility: num(v.initial_flexibility),
        present_flexibility: num(v.present_flexibility),
        insights: v.insights || null,
        custom_notes: v.custom_notes || null,
        custom_measures: v.custom || {},
      },
      { onConflict: "student_id" }
    );
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Measurements saved");
  };

  const customRowsFor = (v: Measures) =>
    fields.map((f) => {
      const e = v.custom?.[f.id] ?? { i: "", p: "" };
      const unit = f.unit ? ` ${f.unit}` : "";
      return {
        label: f.unit ? `${f.name} (${f.unit})` : f.name,
        i: e.i || "",
        p: e.p || "",
        c: compare(e.i || "", e.p || "", unit),
      };
    });

  const openReport = (m: Member) => {
    const v = get(m.id);
    setReport({
      memberName: m.name,
      phone: m.phone,
      email: m.email,
      batchName: batches.find((b) => b.id === m.batch_id)?.name ?? "—",
      measures: { ...v, insights: v.insights || autoInsight(v, m.name, fields) },
      customRows: customRowsFor(v).map((r) => ({ ...r, i: r.i || "—", p: r.p || "—" })),
      sections,
    });
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl">Learning Insights</h1>
        <p className="text-sm text-muted-foreground">Track member progress and generate a printable insights report.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select members</CardTitle>
          <CardDescription>Choose a batch, then apply to all or specific members.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Batch <span className="text-destructive">*</span></Label>
            <Select value={batchId} onValueChange={(v) => { setBatchId(v); setSelected([]); }}>
              <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="cursor-pointer">Select all members</Label>
              <p className="text-xs text-muted-foreground">Applies to every member in the selected batch.</p>
            </div>
            <Switch checked={allMembers} onCheckedChange={setAllMembers} disabled={!batchId} />
          </div>

          {!allMembers && (
            <div className="space-y-2">
              <Label>Apply to specific members</Label>
              <Input
                placeholder={batchId ? "Search members…" : "Select a batch first"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!batchId}
              />
              <div className="max-h-52 overflow-auto rounded-lg border border-border divide-y divide-border">
                {!batchId && <p className="p-3 text-sm text-muted-foreground">Select a batch to choose members.</p>}
                {batchId && searchedMembers.length === 0 && <p className="p-3 text-sm text-muted-foreground">No members found.</p>}
                {searchedMembers.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-3 p-2.5 text-sm">
                    <Checkbox
                      checked={selected.includes(m.id)}
                      onCheckedChange={(c) =>
                        setSelected((s) => (c ? [...s, m.id] : s.filter((x) => x !== m.id)))
                      }
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparison Fields</CardTitle>
          <CardDescription>
            Add a field name once — Initial and Present inputs are created automatically for every member.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="flex-1"
              placeholder="Field name (e.g. Speed, BMI, Blood Pressure)"
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
            />
            <Input
              className="sm:w-36"
              placeholder="Unit (optional)"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            />
            <Button type="button" onClick={addField} disabled={!newField.trim() || addingField}>
              {addingField ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />} Add Custom Field
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom comparison fields yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {fields.map((f) => (
                <div key={f.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  {editId === f.id ? (
                    <>
                      <Input className="flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <Input className="sm:w-32" placeholder="Unit" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => saveFieldEdit(f.id)}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{f.name}{f.unit ? ` (${f.unit})` : ""}</p>
                        <p className="text-xs text-muted-foreground">Initial {f.name} · Present {f.name}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditId(f.id); setEditName(f.name); setEditUnit(f.unit ?? ""); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeField(f)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Include in report</CardTitle>
          <CardDescription>Only the selected sections are printed.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([
            ["memberDetails", "Member Details"],
            ["height", "Height Comparison"],
            ["weight", "Weight Comparison"],
            ["flexibility", "Flexibility / Speed Comparison"],
            ["customFields", "Custom Comparison Fields"],
            ["insights", "Learning Insights"],
            ["notes", "Custom Notes"],
            ["date", "Generated Date"],
          ] as [keyof ReportSections, string][]).map(([key, label]) => (
            <label key={String(key)} className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={sections[key]} onCheckedChange={(c) => setSections((s) => ({ ...s, [key]: !!c }))} />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      {targetMembers.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Select a batch{!allMembers ? " and members" : ""} to record measurements.
        </CardContent></Card>
      ) : (
        targetMembers.map((m) => {
          const v = get(m.id);
          const rows = [
            { label: "Height (cm)", i: v.initial_height, p: v.present_height, c: compare(v.initial_height, v.present_height, " cm") },
            { label: "Weight (kg)", i: v.initial_weight, p: v.present_weight, c: compare(v.initial_weight, v.present_weight, " kg") },
            { label: "Flexibility / Speed (%)", i: v.initial_flexibility, p: v.present_flexibility, c: compare(v.initial_flexibility, v.present_flexibility, "%") },
            ...customRowsFor(v),
          ];
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="text-lg">{m.name}</CardTitle>
                <CardDescription>{batches.find((b) => b.id === m.batch_id)?.name ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label>Initial Height (cm)</Label>
                    <Input inputMode="decimal" value={v.initial_height} onChange={(e) => set(m.id, { initial_height: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Present Height (cm)</Label>
                    <Input inputMode="decimal" value={v.present_height} onChange={(e) => set(m.id, { present_height: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Initial Weight (kg)</Label>
                    <Input inputMode="decimal" value={v.initial_weight} onChange={(e) => set(m.id, { initial_weight: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Present Weight (kg)</Label>
                    <Input inputMode="decimal" value={v.present_weight} onChange={(e) => set(m.id, { present_weight: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Initial Flexibility / Speed (%)</Label>
                    <Input inputMode="decimal" value={v.initial_flexibility} onChange={(e) => set(m.id, { initial_flexibility: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Present Flexibility / Speed (%)</Label>
                    <Input inputMode="decimal" value={v.present_flexibility} onChange={(e) => set(m.id, { present_flexibility: e.target.value })} /></div>

                  {fields.map((f) => {
                    const e = v.custom?.[f.id] ?? { i: "", p: "" };
                    const suffix = f.unit ? ` (${f.unit})` : "";
                    return (
                      <Fragment key={f.id}>
                        <div className="space-y-1.5">
                          <Label>Initial {f.name}{suffix}</Label>
                          <Input value={e.i} onChange={(ev) => setCustom(m.id, f.id, "i", ev.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Present {f.name}{suffix}</Label>
                          <Input value={e.p} onChange={(ev) => setCustom(m.id, f.id, "p", ev.target.value)} />
                        </div>
                      </Fragment>
                    );
                  })}
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left font-medium">Measure</th>
                        <th className="p-2 text-left font-medium">Initial Value</th>
                        <th className="p-2 text-left font-medium">Present Value</th>
                        <th className="p-2 text-left font-medium">Improvement / Comparison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.label} className="border-t border-border">
                          <td className="p-2">{r.label}</td>
                          <td className="p-2">{r.i || "—"}</td>
                          <td className="p-2">{r.p || "—"}</td>
                          <td className="p-2">{r.c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Learning Insights</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => set(m.id, { insights: autoInsight(v, m.name, fields) })}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Auto-generate
                    </Button>
                  </div>
                  <Textarea rows={3} value={v.insights} onChange={(e) => set(m.id, { insights: e.target.value })}
                    placeholder="Editable insights shown on the report…" />
                </div>

                <div className="space-y-1.5">
                  <Label>Custom Notes</Label>
                  <Textarea rows={3} value={v.custom_notes} onChange={(e) => set(m.id, { custom_notes: e.target.value })}
                    placeholder="Personalized comments…" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => save(m)} disabled={saving === m.id}>
                    {saving === m.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save
                  </Button>
                  <Button onClick={() => openReport(m)}>
                    <FileText className="mr-1.5 h-4 w-4" /> Generate report
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <InsightsReportDialog data={report} onClose={() => setReport(null)} />
    </div>
  );
};

export default LearningInsights;
