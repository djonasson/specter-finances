import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { initAuth, setAuthChangeCallback, signIn, signOut, hasStoredToken } from '../services/auth';

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(hasStoredToken);
  const [loading, setLoading] = useState(!hasStoredToken());

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID not set');
      setLoading(false);
      return;
    }

    setAuthChangeCallback(setAuthenticated);
    initAuth(clientId).then(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
