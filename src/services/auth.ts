const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'sf_access_token';
const EXPIRY_KEY = 'sf_token_expiry';

let clientId: string | null = null;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let onAuthChange: ((authenticated: boolean) => void) | null = null;
let initPromise: Promise<void> | null = null;

export function getAccessToken(): string | null {
  if (!accessToken) loadStoredToken();
  return accessToken;
}

/** Check if a non-expired token exists in storage (without loading GIS) */
export function hasStoredToken(): boolean {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  return !!localStorage.getItem(TOKEN_KEY) && !!expiry && Date.now() < Number(expiry);
}

export function setAuthChangeCallback(cb: (authenticated: boolean) => void) {
  onAuthChange = cb;
}

function storeToken(token: string, expiresIn: number | string) {
  accessToken = token;
  const seconds = typeof expiresIn === 'string' ? parseInt(expiresIn, 10) : expiresIn;
  const expiry = Date.now() + (seconds || 3600) * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, String(expiry));
}

function loadStoredToken(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (token && expiry && Date.now() < Number(expiry)) {
    accessToken = token;
    return true;
  }
  clearStoredToken();
  return false;
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  accessToken = null;
}

export function initAuth(id: string): Promise<void> {
  clientId = id;
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    // Check for a stored token before loading GIS
    const hasToken = loadStoredToken();

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: id,
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

/**
 * Request a fresh access token. First tries silently (no prompt).
 * If silent refresh fails, falls back to a consent prompt (small popup)
 * so the user doesn't have to go through the full sign-in flow.
 */
export function refreshToken(): Promise<string> {
  if (!clientId) return Promise.reject(new Error('Auth not initialized'));

  return new Promise((resolve, reject) => {
    // Step 1: try silent refresh
    const silentClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId!,
      scope: SCOPES,
      callback: (response) => {
        if (response.access_token) {
          storeToken(response.access_token, response.expires_in || 3600);
          onAuthChange?.(true);
          resolve(response.access_token);
        } else {
          // Silent failed — fall back to consent prompt
          requestWithConsent(resolve, reject);
        }
      },
      error_callback: () => {
        // Silent failed — fall back to consent prompt
        requestWithConsent(resolve, reject);
      },
      prompt: '',
    });
    silentClient.requestAccessToken({ prompt: '' });
  });
}

function requestWithConsent(
  resolve: (token: string) => void,
  reject: (err: Error) => void,
) {
  if (!clientId) { reject(new Error('Auth not initialized')); return; }
  const consentClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId!,
    scope: SCOPES,
    callback: (response) => {
      if (response.access_token) {
        storeToken(response.access_token, response.expires_in || 3600);
        onAuthChange?.(true);
        resolve(response.access_token);
      } else {
        clearStoredToken();
        onAuthChange?.(false);
        reject(new Error('Session expired — please sign in again'));
      }
    },
    error_callback: () => {
      clearStoredToken();
      onAuthChange?.(false);
      reject(new Error('Session expired — please sign in again'));
    },
  });
  consentClient.requestAccessToken();
}

export function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {});
  }
  clearStoredToken();
  onAuthChange?.(false);
}
