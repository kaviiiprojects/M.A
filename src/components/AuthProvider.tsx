'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, validateCredentials, canAccessRoute, DEFAULT_ROUTE, AUTH_STORAGE_KEY } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Route protection - redirect if not authorized
  useEffect(() => {
    if (isLoading) return;

    // Allow login page always
    if (pathname === '/login') {
      // If already logged in, redirect to appropriate page
      if (user) {
        router.replace(DEFAULT_ROUTE[user.role]);
      }
      return;
    }

    // Not logged in - redirect to login
    if (!user) {
      router.replace('/login');
      return;
    }

    // Check route access
    if (!canAccessRoute(user.role, pathname)) {
      router.replace(DEFAULT_ROUTE[user.role]);
    }
  }, [user, isLoading, pathname, router]);

  const login = useCallback((username: string, password: string): boolean => {
    const validatedUser = validateCredentials(username, password);
    if (validatedUser) {
      setUser(validatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(validatedUser));
      router.replace(DEFAULT_ROUTE[validatedUser.role]);
      return true;
    }
    return false;
  }, [router]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    router.replace('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
