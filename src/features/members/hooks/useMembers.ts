import { useCallback, useEffect, useMemo, useState } from "react";
import type { Batch, Customer, StaffOption } from "../types";
import { memberService } from "../services/memberService";

export function useMembers(workspaceId: string | null, isOwner: boolean) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const fetchCustomers = useCallback(async () => {
    if (workspaceId) setCustomers(await memberService.list(workspaceId));
  }, [workspaceId]);
  const fetchBatches = useCallback(async () => {
    if (workspaceId) setBatches(await memberService.listBatches(workspaceId));
  }, [workspaceId]);
  const fetchStaff = useCallback(async () => {
    setStaffOptions(workspaceId && isOwner ? await memberService.listStaff(workspaceId) : []);
  }, [workspaceId, isOwner]);
  useEffect(() => { void fetchCustomers(); void fetchBatches(); void fetchStaff(); }, [fetchCustomers, fetchBatches, fetchStaff]);
  useEffect(() => {
    if (workspaceId) return memberService.subscribe(workspaceId, fetchCustomers, fetchBatches);
  }, [workspaceId, fetchCustomers, fetchBatches]);
  const customersByBatch = useMemo(() => {
    const grouped = new Map<string, Customer[]>();
    customers.forEach((member) => {
      if (!member.batch_id) return;
      const group = grouped.get(member.batch_id) ?? [];
      group.push(member);
      grouped.set(member.batch_id, group);
    });
    return grouped;
  }, [customers]);
  return { customers, batches, staffOptions, customersByBatch, fetchCustomers, fetchBatches };
}