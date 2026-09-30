import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onUsePhoto: (photo: File) => void; title: string; facingMode?: "user" | "environment" };

export default function PhotoCameraDialog({ open, onOpenChange, onUsePhoto, title, facingMode = "environment" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setCaptured(null);
    setError("");
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable. Use Upload Photo instead.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch (err) {
        if (active) setError(err instanceof Error && err.name === "NotAllowedError" ? "Camera permission denied. Allow camera access or upload a photo instead." : "Camera unavailable. Upload a photo instead.");
      }
    };
    start();
    return () => { active = false; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, [open, facingMode]);

  useEffect(() => {
    if (!captured) { setPreview(null); return; }
    const url = URL.createObjectURL(captured);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [captured]);

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setError("Camera is not ready. Please try again."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { setError("Could not capture this photo. Please try again."); return; }
    setCaptured(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Position everyone in view, then capture a clear photo.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <video ref={videoRef} autoPlay playsInline muted className={captured ? "hidden" : "aspect-video w-full rounded-md bg-muted object-contain"} />
      {preview && <img src={preview} alt="Captured photo preview" className="aspect-video w-full rounded-md bg-muted object-contain" />}
      <div className="flex flex-wrap justify-end gap-2">
        {captured ? <>
          <Button type="button" variant="outline" onClick={() => setCaptured(null)}><RotateCcw className="mr-2 h-4 w-4" />Retake</Button>
          <Button type="button" onClick={() => { onUsePhoto(captured); onOpenChange(false); }}>Use Photo</Button>
        </> : <Button type="button" disabled={!!error} onClick={capture}><Camera className="mr-2 h-4 w-4" />Capture</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}