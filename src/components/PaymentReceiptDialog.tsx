import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export interface ReceiptData {
  receiptNumber: string;
  dateIssued: string;      // ISO yyyy-mm-dd
  customerName: string;
  customerContact?: string;
  batchName: string;
  planDescription: string; // membership/plan/duration description
  paymentMethod: string;
  amount: number;
  durationValue: number;
  durationUnit: string;
  renewalDate: string;     // ISO
  studioName: string;
  studioAddress?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReceiptData | null;
}

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
};

const PaymentReceiptDialog = ({ open, onOpenChange, data }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [working, setWorking] = useState(false);

  if (!data) return null;

  const subtotal = data.amount;
  const total = data.amount;

  const download = async () => {
    if (!ref.current) return;
    setWorking(true);
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let w = pageW - 20;
      let h = w / ratio;
      if (h > pageH - 20) { h = pageH - 20; w = h * ratio; }
      const x = (pageW - w) / 2;
      pdf.addImage(img, "PNG", x, 10, w, h);
      pdf.save(`Receipt-${data.receiptNumber}.pdf`);
      toast.success("Receipt downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    } finally {
      setWorking(false);
    }
  };

  const printReceipt = () => {
    if (!ref.current) return;
    const html = ref.current.outerHTML;
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.write(`<!doctype html><html><head><title>Receipt ${data.receiptNumber}</title>
      <style>
        body{margin:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;color:#111;}
        @page{size:A4;margin:12mm;}
        @media print { body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5">
          <DialogTitle className="font-display">Payment Receipt</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          {/* Printable receipt — plain colors so it looks identical on paper. */}
          <div
            ref={ref}
            className="normal-case-force"
            style={{
              background: "#ffffff",
              color: "#111827",
              padding: "40px 44px",
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
              textTransform: "none",
              letterSpacing: "normal",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0f172a", paddingBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 30, fontWeight: 700, color: "#0f172a", letterSpacing: 1 }}>
                  {data.studioName || "Trinetra Yoga"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, maxWidth: 320, lineHeight: 1.4 }}>
                  {data.studioAddress || "Trinetra Yoga Studio"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: 4 }}>RECEIPT</div>
                <div style={{ fontSize: 12, color: "#374151", marginTop: 8 }}>
                  <div><strong style={{ color: "#6b7280", fontWeight: 500 }}>No.</strong> {data.receiptNumber}</div>
                  <div><strong style={{ color: "#6b7280", fontWeight: 500 }}>Date</strong> {fmtDate(data.dateIssued)}</div>
                </div>
              </div>
            </div>

            {/* Issued To */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 6 }}>Issued To</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{data.customerName}</div>
                {data.customerContact && <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>{data.customerContact}</div>}
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 6 }}>Batch</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{data.batchName || "No Batch Assigned"}</div>
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginTop: 28 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0f172a", color: "#ffffff" }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, letterSpacing: 0.5 }}>Description</th>
                    <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 600, letterSpacing: 0.5, width: 130 }}>Method</th>
                    <th style={{ textAlign: "right", padding: "10px 14px", fontWeight: 600, letterSpacing: 0.5, width: 130 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "14px", verticalAlign: "top" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{data.planDescription}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        Duration: {data.durationValue} {data.durationUnit} · Valid until {fmtDate(data.renewalDate)}
                      </div>
                    </td>
                    <td style={{ padding: "14px", textAlign: "center", textTransform: "uppercase", fontSize: 12, letterSpacing: 1 }}>{data.paymentMethod}</td>
                    <td style={{ padding: "14px", textAlign: "right", fontWeight: 600 }}>₹{subtotal.toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <div style={{ width: 260 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "#374151" }}>
                  <span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 15, fontWeight: 700, color: "#0f172a", borderTop: "2px solid #0f172a", marginTop: 6 }}>
                  <span>Grand Total</span><span>₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Renewal callout */}
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#6b7280" }}>Next Renewal Date</span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmtDate(data.renewalDate)}</span>
            </div>

            {/* Thank you */}
            <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px dashed #d1d5db", textAlign: "center" }}>
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, color: "#0f172a", fontStyle: "italic" }}>
                Thank you for practicing with us
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, letterSpacing: 0.5 }}>
                Namaste · {data.studioName || "Trinetra Yoga"}
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" onClick={printReceipt} disabled={working}>
              <Printer className="h-4 w-4 mr-2" />Print Receipt
            </Button>
            <Button onClick={download} disabled={working}>
              <Download className="h-4 w-4 mr-2" />{working ? "Preparing..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentReceiptDialog;
