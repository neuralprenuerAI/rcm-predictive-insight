import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";
import { Loader2 } from "lucide-react";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export function ProtectedAdminRoute({ 
  children, 
  requireSuperAdmin = false 
}: ProtectedAdminRouteProps) {
  const { isAdmin, isSuperAdmin, isLoading, user } = useRole();
  const location = useLocation();

  // Show loading while checking role
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!requireSuperAdmin && !isAdmin) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default ProtectedAdminRoute;
