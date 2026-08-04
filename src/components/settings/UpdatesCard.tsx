import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { isAutoUpdateEnabled, setAutoUpdateEnabled } from "@/lib/appVersion";
import { formatDate } from "@/lib/date";

const UpdatesCard = () => {
  const { checking, check, update, lastChecked, updateAvailable } = useAppUpdate();
  const [auto, setAuto] = useState(isAutoUpdateEnabled());
  const [busy, setBusy] = useState(false);

  const onCheck = async () => {
    const found = await check();
    if (found) toast.success("A new version is available");
    else toast.success("You're on the latest version");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="h-5 w-5 text-primary" /> App Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {updateAvailable
            ? "A new version has been deployed. Update to load it now."
            : "This app checks for new deployments automatically."}
          {lastChecked && (
            <> Last checked: {formatDate(lastChecked)} {lastChecked.toLocaleTimeString()}.</>
          )}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onCheck} disabled={checking || busy} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking…" : "Check for Updates"}
          </Button>
          <Button
            onClick={async () => { setBusy(true); await update(); }}
            disabled={busy}
          >
            {busy ? "Updating…" : "Update Now"}
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div className="pr-4">
            <Label htmlFor="auto-update">Automatic updates</Label>
            <p className="text-sm text-muted-foreground">
              Load the newest version automatically on your next visit.
            </p>
          </div>
          <Switch
            id="auto-update"
            checked={auto}
            onCheckedChange={(v) => { setAuto(v); setAutoUpdateEnabled(v); toast.success(v ? "Automatic updates on" : "Automatic updates off"); }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default UpdatesCard;
