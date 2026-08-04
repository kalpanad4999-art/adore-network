import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useState } from "react";

const UpdateBanner = () => {
  const { updateAvailable, update, dismiss } = useAppUpdate();
  const [busy, setBusy] = useState(false);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:p-0">
      <div className="rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-foreground">New version available</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Update now to get the latest features and fixes.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => { setBusy(true); await update(); }}
              >
                {busy ? "Updating…" : "Update Now"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
                Later
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss update notice"
            className="text-muted-foreground hover:text-foreground"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
