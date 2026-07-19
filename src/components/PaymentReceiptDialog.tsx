import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Share2, MessageCircle, Image as ImageIcon } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { waLink } from "@/lib/offers";
import logoAsset from "@/assets/trinetra-logo.jpg.asset.json";

const LOGO_REMOTE_URL = (typeof window !== "undefined" ? window.location.origin : "") + logoAsset.url;
// Cache the base64-encoded logo across dialog opens so it renders offline & after hosting.
let LOGO_DATA_URL_CACHE: string | null = null;
const loadLogoDataUrl = async (): Promise<string> => {
  if (LOGO_DATA_URL_CACHE) return LOGO_DATA_URL_CACHE;
  try {
    const cached = typeof localStorage !== "undefined" ? localStorage.getItem("trinetra_logo_dataurl_v1") : null;
    if (cached && cached.startsWith("data:")) { LOGO_DATA_URL_CACHE = cached; return cached; }
  } catch {}
  for (const src of [logoAsset.url, LOGO_REMOTE_URL]) {
    try {
      const res = await fetch(src, { cache: "force-cache" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("read failed"));
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
      LOGO_DATA_URL_CACHE = dataUrl;
      try { localStorage.setItem("trinetra_logo_dataurl_v1", dataUrl); } catch {}
      return dataUrl;
    } catch { /* try next */ }
  }
  return LOGO_REMOTE_URL;
};


export interface ReceiptData {
  receiptNumber: string;
  dateIssued: string;
  customerName: string;
  customerContact?: string;
  batchName: string;
  planDescription: string;
  paymentMethod: string;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  offerName?: string;
  offerCongrats?: string;
  offerMessage?: string;
  couponCode?: string;
  durationValue: number;
  durationUnit: string;
  renewalDate: string;
  studioName: string;
  studioAddress?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReceiptData | null;
}

const LOGO_URL = (typeof window !== "undefined" ? window.location.origin : "") + logoAsset.url;

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

  const discount = Number(data.discountAmount || 0);
  const subtotal = data.originalAmount != null ? Number(data.originalAmount) : Number(data.amount) + discount;
  const total = Number(data.amount);
  const hasOffer = discount > 0;

  const snapshot = async (): Promise<HTMLCanvasElement> => {
    if (!ref.current) throw new Error("Receipt not ready");
    return await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true, allowTaint: true });
  };

  const download = async () => {
    setWorking(true);
    try {
      const canvas = await snapshot();
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
    } finally { setWorking(false); }
  };

  const downloadImage = async () => {
    setWorking(true);
    try {
      const canvas = await snapshot();
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Receipt-${data.receiptNumber}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Image saved");
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate image");
    } finally { setWorking(false); }
  };

  const buildShareText = (includeOffer: boolean) => {
    const lines = [
      includeOffer && data.offerCongrats ? data.offerCongrats : "",
      includeOffer && data.offerMessage ? data.offerMessage : "",
      `Hi ${data.customerName}, here's your payment receipt from ${data.studioName}.`,
      `Receipt No: ${data.receiptNumber}`,
      `Plan: ${data.planDescription}`,
      includeOffer && data.offerName ? `Offer: ${data.offerName}` : "",
      includeOffer && data.couponCode ? `Coupon: ${data.couponCode}` : "",
      includeOffer && hasOffer ? `Discount: ₹${discount.toLocaleString("en-IN")} (You saved ₹${discount.toLocaleString("en-IN")})` : "",
      `Amount Paid: ₹${total.toLocaleString("en-IN")}`,
      data.renewalDate ? `Valid until: ${fmtDate(data.renewalDate)}` : "",
      "",
      "Thank you! 🙏",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const shareReceipt = async () => {
    setWorking(true);
    try {
      const canvas = await snapshot();
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Failed");
      const file = new File([blob], `Receipt-${data.receiptNumber}.png`, { type: "image/png" });
      const shareText = buildShareText(hasOffer);
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: "Payment Receipt", text: shareText });
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("Receipt opened — save and share it");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message || "Share failed");
    } finally { setWorking(false); }
  };

  const sendWhatsApp = async () => {
    setWorking(true);
    try {
      const canvas = await snapshot();
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const shareText = buildShareText(hasOffer);
      if (blob) {
        const file = new File([blob], `Receipt-${data.receiptNumber}.png`, { type: "image/png" });
        if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
          try {
            await (navigator as any).share({ files: [file], title: "Payment Receipt", text: shareText });
            return;
          } catch (err: any) {
            if (err?.name === "AbortError") return;
          }
        }
        // Fallback: download image so user can attach it, then open WhatsApp with text.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Receipt-${data.receiptNumber}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Receipt saved — attach it in WhatsApp");
      }
      window.open(waLink(data.customerContact, shareText), "_blank");
    } catch (e: any) {
      toast.error(e?.message || "WhatsApp failed");
    } finally { setWorking(false); }
  };

  const printReceipt = () => {
    if (!ref.current) return;
    const html = ref.current.outerHTML;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { toast.error("Popup blocked"); return; }
    w.document.write(`<!doctype html><html><head><title>Receipt ${data.receiptNumber}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body{margin:0;font-family:'DM Sans',Arial,sans-serif;background:#fff;color:#0f172a;}
        @page{size:A4;margin:12mm;}
        @media print { body{-webkit-print-color-adjust:exact;print-color-adjust:exact;} }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // Palette
  const INK = "#0B1F3A";       // deep indigo (from logo bg)
  const INK_SOFT = "#334155";
  const MUTED = "#6b7280";
  const ACCENT = "#B4531F";    // warm terracotta accent
  const GOLD = "#C9A24B";
  const CREAM = "#FBF7F0";
  const LINE = "#E6E1D6";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5">
          <DialogTitle className="font-display">Payment Receipt</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div
            ref={ref}
            style={{
              background: "#ffffff",
              color: INK,
              padding: 0,
              fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
              textTransform: "none",
              letterSpacing: "normal",
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              overflow: "hidden",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Header band */}
            <div style={{ background: INK, color: "#fff", padding: "22px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 68, height: 68, borderRadius: 10, background: "#fff", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <img src={LOGO_URL} alt="Logo" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1 }}>
                    {data.studioName || "TRINETRA YOGA"}
                  </div>
                  <div style={{ fontSize: 11, color: GOLD, marginTop: 6, fontStyle: "italic", letterSpacing: 0.5 }}>
                    listen to and respect your body
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 24, fontWeight: 600, letterSpacing: 6, color: GOLD }}>RECEIPT</div>
                <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>#{data.receiptNumber}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{fmtDate(data.dateIssued)}</div>
              </div>
            </div>

            {/* Address strip */}
            {data.studioAddress ? (
              <div style={{ background: CREAM, borderBottom: `1px solid ${LINE}`, padding: "8px 32px", fontSize: 11, color: INK_SOFT, textAlign: "center" }}>
                {data.studioAddress}
              </div>
            ) : null}

            <div style={{ padding: "26px 32px" }}>
              {/* Issued To / Batch */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.8, color: MUTED, marginBottom: 6, fontWeight: 600 }}>Billed To</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{data.customerName}</div>
                  {data.customerContact && <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>{data.customerContact}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.8, color: MUTED, marginBottom: 6, fontWeight: 600 }}>Batch</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: INK }}>{data.batchName || "No Batch Assigned"}</div>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>
                    Payment: <span style={{ textTransform: "uppercase", fontWeight: 600, letterSpacing: 1 }}>{data.paymentMethod}</span>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div style={{ marginTop: 24, border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: CREAM, padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 130px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: INK_SOFT, fontWeight: 700 }}>
                  <div>Description</div>
                  <div style={{ textAlign: "right" }}>Amount</div>
                </div>
                <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 130px", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{data.planDescription}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      Duration: {data.durationValue} {data.durationUnit} · Valid until {fmtDate(data.renewalDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 14, fontWeight: 600, color: INK }}>{money(subtotal)}</div>
                </div>
              </div>

              {/* Offer banner */}
              {hasOffer ? (
                <div style={{ marginTop: 16, padding: "14px 18px", background: "linear-gradient(135deg,#FFF7ED 0%, #FEF3C7 100%)", border: `1px solid ${GOLD}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                    {data.offerCongrats || "🎉 Offer Applied"}
                  </div>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 4, lineHeight: 1.5 }}>
                    {data.offerName ? <><strong>{data.offerName}</strong>{" · "}</> : null}
                    {data.couponCode ? <>Coupon <strong>{data.couponCode}</strong>{" · "}</> : null}
                    You saved <strong style={{ color: ACCENT }}>{money(discount)}</strong>
                  </div>
                </div>
              ) : null}

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                <div style={{ width: 300 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: INK_SOFT }}>
                    <span>Subtotal</span><span>{money(subtotal)}</span>
                  </div>
                  {hasOffer ? (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: ACCENT, fontWeight: 600 }}>
                      <span>Discount{data.couponCode ? ` (${data.couponCode})` : ""}</span>
                      <span>−{money(discount)}</span>
                    </div>
                  ) : null}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", fontSize: 15, fontWeight: 700, color: "#fff", background: INK, borderRadius: 6, marginTop: 8 }}>
                    <span style={{ letterSpacing: 0.5 }}>Grand Total</span><span>{money(total)}</span>
                  </div>
                </div>
              </div>

              {/* Renewal */}
              <div style={{ marginTop: 22, padding: "14px 18px", background: CREAM, border: `1px dashed ${GOLD}`, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: INK_SOFT, textTransform: "uppercase", letterSpacing: 1.5, fontSize: 11, fontWeight: 600 }}>Next Renewal</span>
                <span style={{ fontWeight: 700, color: INK, fontSize: 14 }}>{fmtDate(data.renewalDate)}</span>
              </div>

              {/* Thank you */}
              <div style={{ marginTop: 30, paddingTop: 22, borderTop: `1px solid ${LINE}`, textAlign: "center" }}>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, color: INK, fontStyle: "italic" }}>
                  Thank you for practicing with us
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 6, letterSpacing: 2, textTransform: "uppercase" }}>
                  Namaste · {data.studioName || "Trinetra Yoga"}
                </div>
              </div>
            </div>

            {/* Footer bar */}
            <div style={{ background: INK, color: GOLD, padding: "10px 32px", textAlign: "center", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
              This is a computer-generated receipt
            </div>
          </div>

          <div className="flex gap-2 mt-4 justify-end flex-wrap">
            <Button variant="outline" onClick={printReceipt} disabled={working}>
              <Printer className="h-4 w-4 mr-2" />Print Receipt
            </Button>
            <Button variant="outline" onClick={download} disabled={working}>
              <Download className="h-4 w-4 mr-2" />{working ? "…" : "Download PDF"}
            </Button>
            <Button variant="outline" onClick={downloadImage} disabled={working}>
              <ImageIcon className="h-4 w-4 mr-2" />Download Image
            </Button>
            <Button variant="outline" onClick={shareReceipt} disabled={working}>
              <Share2 className="h-4 w-4 mr-2" />Share Receipt
            </Button>
            <Button onClick={sendWhatsApp} disabled={working} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentReceiptDialog;
