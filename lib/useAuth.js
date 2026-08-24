import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getSession, clearSession, isAdmin } from './auth';

export function AuthSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  );
}

export function useAuth(requireAuth = true) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const session = getSession();

    if (session) {
      setUser(session);
    } else if (requireAuth) {
      router.replace('/login');
    }

    setIsLoading(false);
  }, [requireAuth, router]);

  const logout = () => {
    clearSession();
    setUser(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('checklist_passed');
    }
    router.replace('/login');
  };

  return {
    user,
    isLoading,
    logout,
    isAdmin: isAdmin(user),
    isAuthenticated: !!user,
  };
}
