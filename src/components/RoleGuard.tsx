import { ReactNode } from 'react';
import { useUserRole, UserRole } from '@/hooks/useUserRole';

interface RoleGuardProps {
  requiredRole: UserRole;
  children: ReactNode;
  fallback?: ReactNode;
}

export const RoleGuard = ({ requiredRole, children, fallback = null }: RoleGuardProps) => {
  const { hasRole, loading } = useUserRole();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-20"></div>
      </div>
    );
  }

  if (!hasRole(requiredRole)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};