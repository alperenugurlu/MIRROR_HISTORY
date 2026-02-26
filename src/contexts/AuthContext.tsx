import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../../shared/types';
import { useApi } from '../hooks/useApi';
import { setAuthToken } from '../hooks/httpApi';

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check if we have a valid session
  useEffect(() => {
    api.getAuthUser()
      .then((u) => {
        if (u) setUser(u);
      })
      .catch(() => {
        // Not authenticated
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loginFn = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password);
    // Store JWT for HTTP mode
    if (result.token) {
      setAuthToken(result.token);
    }
    setUser(result.user);
  }, [api]);

  const logoutFn = useCallback(async () => {
    await api.logout();
    setAuthToken(null);
    setUser(null);
  }, [api]);

  const changePasswordFn = useCallback(async (oldPassword: string, newPassword: string) => {
    try {
      const result = await api.changePassword(oldPassword, newPassword);
      if (result.success && user) {
        setUser({ ...user, mustChangePassword: false });
      }
      return result;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to change password' };
    }
  }, [api, user]);

  const updateUser = useCallback((u: AuthUser) => setUser(u), []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!user,
      user,
      isLoading,
      login: loginFn,
      logout: logoutFn,
      changePassword: changePasswordFn,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
