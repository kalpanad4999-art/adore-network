import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyUpdate,
  fetchDeployedBuildId,
  getKnownBuildId,
  isAutoUpdateEnabled,
  rememberBuildId,
} from "@/lib/appVersion";

const POLL_MS = 5 * 60 * 1000;
const AUTO_DONE_KEY = "trinetra.app.autoUpdateDone";

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const bootRef = useRef(true);

  const check = useCallback(async (opts?: { silent?: boolean }) => {
    if (import.meta.env.DEV) { bootRef.current = false; return false; }
    setChecking(true);
    try {
      const deployed = await fetchDeployedBuildId();

      setLastChecked(new Date());
      if (!deployed) return false;
      const known = getKnownBuildId();
      // No hashed build assets on the page (dev server / unexpected markup):
      // we can't compare reliably, so never claim an update is available.
      if (!known) {
        rememberBuildId(deployed);
        return false;
      }
      if (known !== deployed) {
        // Auto update on a fresh visit, once per session.
        let autoDone = false;
        try { autoDone = sessionStorage.getItem(AUTO_DONE_KEY) === "1"; } catch { /* ignore */ }
        if (bootRef.current && isAutoUpdateEnabled() && !autoDone) {
          try { sessionStorage.setItem(AUTO_DONE_KEY, "1"); } catch { /* ignore */ }
          rememberBuildId(deployed);
          void applyUpdate();
          return true;
        }
        setUpdateAvailable(true);
        return true;
      }
      rememberBuildId(deployed);
      setUpdateAvailable(false);
      return false;
    } finally {
      bootRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    const onFocus = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  const update = useCallback(async () => {
    const deployed = await fetchDeployedBuildId();
    if (deployed) rememberBuildId(deployed);
    await applyUpdate();
  }, []);

  return { updateAvailable, checking, lastChecked, check, update, dismiss: () => setUpdateAvailable(false) };
};
