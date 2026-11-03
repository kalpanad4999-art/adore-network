import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { buildRenewals, pendingRenewals } from "./renewalRules";

export function useRenewalData() {
  const { user } = useAuth();
  const { ownerId, isOwner, permissions, loading: studioLoading } = useStudio();
  const workspaceId = ownerId ?? user?.id ?? null;
  const allowed = !studioLoading && !!workspaceId && (isOwner || permissions.renewals);
  const [day, setDay] = useState(0);
  const query = useQuery({
    queryKey: ["renewal-data", workspaceId, user?.id],
    enabled: allowed,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      if (!workspaceId) throw new Error("Studio not available");
      const [cust, pays, bat] = await Promise.all([
        supabase.from("students").select("id,name,phone,batch_id").eq("user_id", workspaceId).order("name"),
        supabase.from("student_payments").select("*").eq("user_id", workspaceId).order("paid_on", { ascending: false }),
        supabase.from("batches").select("id,name").eq("user_id", workspaceId).order("name"),
      ]);
      if (cust.error) throw cust.error;
      if (pays.error) throw pays.error;
      if (bat.error) throw bat.error;
      return { customers: cust.data ?? [], payments: pays.data ?? [], batches: bat.data ?? [] };
    },
  });
  const { refetch } = query;
  useEffect(() => {
    if (!allowed || !workspaceId) return;
    const refresh = () => { setDay(d => d + 1); void refetch(); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const ch = supabase.channel(`renewals-sync-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "student_payments", filter: `user_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "batches", filter: `user_id=eq.${workspaceId}` }, refresh).subscribe();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      timer = setTimeout(() => { refresh(); schedule(); }, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime());
    };
    schedule();
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(ch);
    };
  }, [allowed, workspaceId, refetch]);
  const renewals = useMemo(() => allowed ? buildRenewals(query.data?.customers ?? [], query.data?.payments ?? []) : [], [allowed, query.data, day]);
  return { workspaceId, userId: user?.id, allowed, renewals, pending: pendingRenewals(renewals), batches: allowed ? query.data?.batches ?? [] : [], loading: query.isPending || query.isFetching, error: query.error, fetchAll: refetch };
}

export const RenewalDataContext = createContext<ReturnType<typeof useRenewalData> | null>(null);
export function useRenewalContext() {
  const context = useContext(RenewalDataContext);
  if (!context) throw new Error("Renewal data requires the app layout");
  return context;
}