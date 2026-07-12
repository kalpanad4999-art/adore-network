import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  title: string;
  description?: string;
}

const ShareLinkDialog = ({ open, onOpenChange, url, title, description }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);

  const downloadQR = () => {
    const svg = wrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-qr.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>{description || "Permanent public link — always shows the latest content."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div ref={wrapRef} className="flex justify-center p-4 bg-white rounded-lg">
            <QRCodeSVG value={url} size={200} />
          </div>
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={downloadQR}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareLinkDialog;
