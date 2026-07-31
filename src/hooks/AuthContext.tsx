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

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(hasStoredToken);
  // Nothing to wait for if there's no client id or we already have a token.
  const [loading, setLoading] = useState(!!clientId && !hasStoredToken());

  useEffect(() => {
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID not set');
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

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
