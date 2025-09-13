import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'citizen' | 'authority' | 'admin';

export const useUserRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .order('role', { ascending: true }) // Admin first, then authority, then citizen
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user role:', error);
          setRole('citizen'); // Default to citizen on error
        } else {
          setRole(data?.role || 'citizen');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setRole('citizen'); // Default to citizen on error
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user?.id]);

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!role) return false;
    
    const roleHierarchy = { admin: 3, authority: 2, citizen: 1 };
    return roleHierarchy[role] >= roleHierarchy[requiredRole];
  };

  const isAdmin = () => role === 'admin';
  const isAuthority = () => role === 'authority' || role === 'admin';
  const isCitizen = () => role === 'citizen';

  return {
    role,
    loading,
    hasRole,
    isAdmin,
    isAuthority,
    isCitizen
  };
};