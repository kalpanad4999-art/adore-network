
-- Re-grant EXECUTE on helper functions used inside RLS policies. Without EXECUTE,
-- policy evaluation fails and legitimate queries error out. Trigger-only functions
-- remain locked down.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) TO authenticated;
