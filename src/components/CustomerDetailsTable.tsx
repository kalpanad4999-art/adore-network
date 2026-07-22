import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowRightLeft, ArrowUpDown, ArrowUp, ArrowDown, Download, Pencil, Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  batch_id: string | null;
  custom_data: Record<string, string> | null;
}
interface CustomField { id: string; name: string; required: boolean; enabled: boolean }
interface BatchLite { id: string; name: string; required_fields: string[]; custom_fields: CustomField[] }

interface Props {
  batch: BatchLite;
  rows: CustomerRow[];
  allBatches: { id: string; name: string }[];
  canDelete: boolean;
  onEdit: (row: CustomerRow) => void;
  onDelete: (row: CustomerRow) => void;
  onMove: (customerId: string, targetBatchId: string) => void;
}

interface Column {
  key: string;
  label: string;
  width: number;
  get: (r: CustomerRow) => string;
}

const CORE_COLS: Record<string, { label: string; get: (r: CustomerRow) => string; width: number }> = {
  name:    { label: "Name",         width: 180, get: (r) => r.name || "" },
  email:   { label: "Email",        width: 220, get: (r) => r.email || "" },
  phone:   { label: "Phone",        width: 150, get: (r) => r.phone || "" },
  address: { label: "Address",      width: 240, get: (r) => r.address || "" },
  height:  { label: "Height (cm)",  width: 110, get: (r) => (r.height_cm != null ? String(r.height_cm) : "") },
  weight:  { label: "Weight (kg)",  width: 110, get: (r) => (r.weight_kg != null ? String(r.weight_kg) : "") },
  notes:   { label: "Notes",        width: 240, get: (r) => r.notes || "" },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function CustomerDetailsTable({ batch, rows, allBatches, canDelete, onEdit, onDelete, onMove }: Props) {
  const columns = useMemo<Column[]>(() => {
    const req = batch.required_fields || [];
    // Always include Name first; include the other configured core fields in canonical order.
    const order = ["name", "phone", "email", "address", "height", "weight", "notes"];
    const coreKeys = order.filter((k) => k === "name" || req.includes(k));
    const cols: Column[] = coreKeys.map((k) => ({ key: `core:${k}`, ...CORE_COLS[k] }));
    (batch.custom_fields || []).filter((f) => f.enabled !== false).forEach((f) => {
      cols.push({ key: `custom:${f.id}`, label: f.name || "Custom", width: 180, get: (r) => r.custom_data?.[f.id] || "" });
    });
    return cols;
  }, [batch.required_fields, batch.custom_fields]);

  const [widths, setWidths] = useState<Record<string, number>>({});
  const getWidth = (c: Column) => widths[c.key] ?? c.width;

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("core:name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => c.get(r).toLowerCase().includes(q)));
  }, [rows, search, columns]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.get(a); const bv = col.get(b);
      const an = Number(av); const bn = Number(bv);
      if (av !== "" && bv !== "" && !isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
      return av.localeCompare(bv, undefined, { sensitivity: "base" }) * dir;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const onResizeStart = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widths[key] ?? columns.find((c) => c.key === key)!.width;
    const move = (ev: MouseEvent) => {
      const next = Math.max(70, startW + (ev.clientX - startX));
      setWidths((w) => ({ ...w, [key]: next }));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const exportData = () => {
    const header = columns.map((c) => c.label);
    const body = sorted.map((r) => columns.map((c) => c.get(r)));
    return { header, body };
  };

  const exportCSV = () => {
    const { header, body } = exportData();
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...body].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, `${batch.name}-members.csv`);
  };
  const exportXLSX = () => {
    const { header, body } = exportData();
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = columns.map((c) => ({ wch: Math.min(40, Math.max(10, c.label.length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, `${batch.name}-members.xlsx`);
  };
  const exportPDF = () => {
    const { header, body } = exportData();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`${batch.name} — Members`, 40, 32);
    autoTable(doc, {
      head: [header],
      body,
      startY: 48,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [34, 60, 55], textColor: 255 },
      margin: { left: 24, right: 24 },
    });
    doc.save(`${batch.name}-members.pdf`);
  };
  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  };

  const totalWidth = columns.reduce((s, c) => s + getWidth(c), 0) + 140; /* actions col */

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search members…"
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{sorted.length} of {rows.length}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export current view</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCSV}>CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportXLSX}>Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>PDF (.pdf)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto bg-card">
        <table className="text-sm border-collapse" style={{ width: totalWidth, minWidth: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {columns.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    style={{ width: getWidth(c), minWidth: getWidth(c) }}
                    className="relative px-3 py-2 text-left font-medium border-r border-primary-foreground/10 select-none"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="flex items-center gap-1.5 w-full truncate hover:opacity-90"
                      title={`Sort by ${c.label}`}
                    >
                      <span className="truncate">{c.label}</span>
                      {active ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />) : <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" />}
                    </button>
                    <span
                      onMouseDown={(e) => onResizeStart(c.key, e)}
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary-foreground/40"
                    />
                  </th>
                );
              })}
              <th style={{ width: 140, minWidth: 140 }} className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center italic text-muted-foreground py-8">
                  {rows.length === 0 ? "No members in this batch yet." : "No members match your search."}
                </td>
              </tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ width: getWidth(c), minWidth: getWidth(c) }}
                    className="px-3 py-2 border-r border-border/60 align-top truncate"
                    title={c.get(r)}
                  >
                    {c.get(r) || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right" style={{ width: 140, minWidth: 140 }}>
                  <div className="inline-flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button title="Move batch" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><ArrowRightLeft className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Move to batch</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {allBatches.filter((b) => b.id !== r.batch_id).length === 0 ? (
                          <DropdownMenuItem disabled>No other batches</DropdownMenuItem>
                        ) : (
                          allBatches.filter((b) => b.id !== r.batch_id).map((b) => (
                            <DropdownMenuItem key={b.id} onClick={() => onMove(r.id, b.id)}>{b.name}</DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button onClick={() => onEdit(r)} title="Edit" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    {canDelete && (
                      <button onClick={() => onDelete(r)} title="Delete" className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            className="h-8 rounded-md border bg-background px-2"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span>Page {page + 1} of {pageCount}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
