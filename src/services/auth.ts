const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'sf_access_token';
const EXPIRY_KEY = 'sf_token_expiry';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let onAuthChange: ((authenticated: boolean) => void) | null = null;
let initPromise: Promise<void> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAuthChangeCallback(cb: (authenticated: boolean) => void) {
  onAuthChange = cb;
}

function storeToken(token: string, expiresIn: number) {
  accessToken = token;
  const expiry = Date.now() + expiresIn * 1000;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRY_KEY, String(expiry));
}

function loadStoredToken(): boolean {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = sessionStorage.getItem(EXPIRY_KEY);
  if (token && expiry && Date.now() < Number(expiry)) {
    accessToken = token;
    return true;
  }
  clearStoredToken();
  return false;
}

function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  accessToken = null;
}

export function initAuth(clientId: string): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    // Check for a stored token before loading GIS
    const hasToken = loadStoredToken();

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            // GIS returns expires_in as a string in seconds
            const expiresIn = response.expires_in || 3600;
            storeToken(response.access_token, expiresIn);
            onAuthChange?.(true);
          }
        },
      });

      if (hasToken) {
        // Restore session without prompting
        onAuthChange?.(true);
      }

      resolve();
    };
    document.head.appendChild(script);
  });

  return initPromise;
}

export function signIn() {
  if (!tokenClient) throw new Error('Auth not initialized');
  tokenClient.requestAccessToken();
}

export function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  clearStoredToken();
  onAuthChange?.(false);
}
