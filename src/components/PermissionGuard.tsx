import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useStudio, ModuleKey } from "@/contexts/StudioContext";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  module: ModuleKey;
  children: ReactNode;
}

/**
 * Route-level permission gate. Owners always pass. Staff pass only when the
 * owner has granted access to the module and the account is active. Backend
 * RLS also enforces this; the guard is a UX layer to hide inaccessible pages.
 */
const PermissionGuard = ({ module, children }: Props) => {
  const { isOwner, permissions, loading } = useStudio();
  if (loading) return null;
  if (isOwner || permissions[module]) return <>{children}</>;
  return (
    <div className="max-w-xl mx-auto pt-12">
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          You don't have access to this section. Ask your studio owner to enable it.
        </CardContent>
      </Card>
    </div>
  );
};

export default PermissionGuard;
