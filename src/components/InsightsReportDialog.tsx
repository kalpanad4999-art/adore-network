import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Image as ImageIcon, Loader2, Mail, Share2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { fmtDate } from "@/lib/date";

export interface ReportSections {
  memberDetails: boolean;
  height: boolean;
  weight: boolean;
  flexibility: boolean;
  insights: boolean;
  notes: boolean;
  date: boolean;
}

export interface InsightsReportData {
  memberName: string;
  phone: string | null;
  email: string | null;
  batchName: string;
  measures: {
    initial_height: string; present_height: string;
    initial_weight: string; present_weight: string;
    initial_flexibility: string; present_flexibility: string;
    insights: string; custom_notes: string;
  };
  sections: ReportSections;
}

const NAVY = "#123a6b";
const GOLD = "#d4a017";

const diff = (a: string, b: string, unit: string) => {
  const x = a.trim() === "" ? null : Number(a);
  const y = b.trim() === "" ? null : Number(b);
  if (x === null || y === null || isNaN(x) || isNaN(y)) return "—";
  const d = Math.round((y - x) * 100) / 100;
  if (d === 0) return "No change";
  return `${d > 0 ? "+" : ""}${d}${unit}`;
};

const InsightsReportDialog = ({ data, onClose }: { data: InsightsReportData | null; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [working, setWorking] = useState(false);

  if (!data) return null;
  const s = data.sections;
  const m = data.measures;
  const fileBase = `Learning-Insights-${data.memberName.replace(/[^a-zA-Z0-9]+/g, "-")}`;

  const rows = [
    s.height && { label: "Height (cm)", i: m.initial_height || "—", p: m.present_height || "—", c: diff(m.initial_height, m.present_height, " cm") },
    s.weight && { label: "Weight (kg)", i: m.initial_weight || "—", p: m.present_weight || "—", c: diff(m.initial_weight, m.present_weight, " kg") },
    s.flexibility && { label: "Flexibility / Speed (%)", i: m.initial_flexibility || "—", p: m.present_flexibility || "—", c: diff(m.initial_flexibility, m.present_flexibility, "%") },
  ].filter(Boolean) as { label: string; i: string; p: string; c: string }[];

  const snapshot = async () => {
    if (!ref.current) throw new Error("Report not ready");
    return await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  };

  const toBlob = async (): Promise<Blob> => {
    const canvas = await snapshot();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("Failed to render report");
    return blob;
  };

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    try { await fn(); } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message || "Something went wrong");
    } finally { setWorking(false); }
  };

  const downloadPng = () => run(async () => {
    saveBlob(await toBlob(), `${fileBase}.png`);
    toast.success("Image saved");
  });

  const buildPdf = async () => {
    const canvas = await snapshot();
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let w = pageW - 20;
    let h = w / ratio;
    if (h > pageH - 20) { h = pageH - 20; w = h * ratio; }
    pdf.addImage(img, "PNG", (pageW - w) / 2, 10, w, h);
    return pdf;
  };

  const downloadPdf = () => run(async () => {
    (await buildPdf()).save(`${fileBase}.pdf`);
    toast.success("PDF downloaded");
  });

  const shareText = `Hi ${data.memberName}, here is your Learning Insights report from TRINETRA YOGA.`;

  const shareOther = () => run(async () => {
    const blob = await toBlob();
    const file = new File([blob], `${fileBase}.png`, { type: "image/png" });
    if ((navigator as any).canShare?.({ files: [file] })) {
      await (navigator as any).share({ files: [file], title: "Learning Insights", text: shareText });
    } else {
      saveBlob(blob, `${fileBase}.png`);
      toast.success("Report saved — attach it in your app of choice");
    }
  });

  const shareWhatsApp = () => run(async () => {
    const raw = (data.phone || "").replace(/[^0-9]/g, "");
    if (!raw) { toast.error("This member has no registered phone number."); return; }
    const digits = raw.length === 10 ? `91${raw}` : raw;
    const blob = await toBlob();
    // Save the image so it can be attached in the chat that opens with the member's number.
    saveBlob(blob, `${fileBase}.png`);
    setTimeout(() => {
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(shareText)}`, "_blank");
    }, 500);
    toast.success("Report saved — attach it in the WhatsApp chat");
  });

  const shareEmail = () => run(async () => {
    const to = (data.email || "").trim();
    if (!to) { toast.error("This member has no registered email address."); return; }
    (await buildPdf()).save(`${fileBase}.pdf`);
    setTimeout(() => {
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("Your Learning Insights — TRINETRA YOGA")}&body=${encodeURIComponent(`${shareText}\n\nThe report is attached.`)}`;
    }, 500);
    toast.success("PDF saved — attach it in the email draft");
  });

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Learning Insights Report</DialogTitle>
          <DialogDescription>Preview, download or share the A4 report.</DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <div
            ref={ref}
            style={{ width: 794, minHeight: 1123, background: "#ffffff", color: "#1c2b3a", fontFamily: "'DM Sans', sans-serif" }}
            className="mx-auto"
          >
            <div style={{ background: NAVY, padding: "28px 40px", borderBottom: `6px solid ${GOLD}` }}>
              <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 42, letterSpacing: 2, color: "#ffffff", textTransform: "uppercase", textAlign: "center" }}>
                Trinetra Yoga
              </h1>
              <p style={{ margin: "6px 0 0", textAlign: "center", color: GOLD, fontSize: 14, letterSpacing: 4, textTransform: "uppercase" }}>
                Learning Insights Report
              </p>
            </div>

            <div style={{ padding: "32px 40px" }}>
              {s.memberDetails && (
                <div style={{ display: "flex", gap: 24, marginBottom: 26 }}>
                  <div style={{ flex: 1, border: `1px solid ${NAVY}22`, borderLeft: `4px solid ${GOLD}`, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: NAVY, opacity: 0.7 }}>Member Name</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{data.memberName}</div>
                  </div>
                  <div style={{ flex: 1, border: `1px solid ${NAVY}22`, borderLeft: `4px solid ${GOLD}`, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: NAVY, opacity: 0.7 }}>Batch</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{data.batchName}</div>
                  </div>
                </div>
              )}

              {rows.length > 0 && (
                <div style={{ marginBottom: 26 }}>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: NAVY, margin: "0 0 10px" }}>Progress Comparison</h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: NAVY, color: "#fff" }}>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Measure</th>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Initial Value</th>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Present Value</th>
                        <th style={{ textAlign: "left", padding: "10px 12px" }}>Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.label} style={{ background: i % 2 ? "#f6f8fc" : "#fff" }}>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${NAVY}1a`, fontWeight: 600 }}>{r.label}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${NAVY}1a` }}>{r.i}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${NAVY}1a` }}>{r.p}</td>
                          <td style={{ padding: "10px 12px", borderBottom: `1px solid ${NAVY}1a`, color: NAVY, fontWeight: 700 }}>{r.c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {s.insights && m.insights && (
                <div style={{ marginBottom: 22 }}>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: NAVY, margin: "0 0 8px" }}>Learning Insights</h2>
                  <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14, background: "#f6f8fc", borderLeft: `4px solid ${GOLD}`, padding: "12px 16px", whiteSpace: "pre-wrap" }}>{m.insights}</p>
                </div>
              )}

              {s.notes && m.custom_notes && (
                <div style={{ marginBottom: 22 }}>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: NAVY, margin: "0 0 8px" }}>Custom Notes</h2>
                  <p style={{ margin: 0, lineHeight: 1.7, fontSize: 14, border: `1px solid ${NAVY}22`, padding: "12px 16px", whiteSpace: "pre-wrap" }}>{m.custom_notes}</p>
                </div>
              )}

              {s.date && (
                <p style={{ marginTop: 34, fontSize: 12, color: NAVY, opacity: 0.75 }}>
                  Generated on {fmtDate(new Date())}
                </p>
              )}
            </div>

            <div style={{ marginTop: 8, borderTop: `6px solid ${GOLD}`, background: NAVY, color: "#fff", padding: "12px 40px", fontSize: 12, textAlign: "center", letterSpacing: 1 }}>
              TRINETRA YOGA — Practice with consistency, progress with grace.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={downloadPng} disabled={working}>
            {working ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1.5 h-4 w-4" />} PNG
          </Button>
          <Button variant="outline" onClick={downloadPdf} disabled={working}>
            <FileDown className="mr-1.5 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={shareWhatsApp} disabled={working}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={shareEmail} disabled={working}>
            <Mail className="mr-1.5 h-4 w-4" /> Email
          </Button>
          <Button onClick={shareOther} disabled={working}>
            <Share2 className="mr-1.5 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InsightsReportDialog;
