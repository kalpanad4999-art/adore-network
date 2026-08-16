-- RLS policies call these helpers as the querying role, so authenticated users
-- must be able to execute them. Anonymous access stays revoked.
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_workspace_owner() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_workspace_owner() FROM anon;