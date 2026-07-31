/**
 * Per-file access, not account-wide.
 *
 * The old `spreadsheets` scope granted read/write/delete on EVERY spreadsheet
 * the account could reach, while the app only ever touches one. `drive.file`
 * limits the token to files the user picks (see services/picker.ts), so a
 * leaked token exposes this sheet and nothing else.
 */
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
// Suffixed: tokens stored under the old broad scope must not be reused.
const TOKEN_KEY = 'sf_access_token_drivefile';
const EXPIRY_KEY = 'sf_token_expiry_drivefile';

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
    script.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      resolve();
    };
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: SCOPES,
        callback: (response) => {
          if (response.access_token) {
            const expiresIn = response.expires_in || 3600;
            storeToken(response.access_token, expiresIn);
            onAuthChange?.(true);
          }
        },
        error_callback: (err) => {
          console.warn('Auth error:', err);
          // Popup was blocked or user closed it — stay on sign-in screen
          onAuthChange?.(false);
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

/**
 * The Cloud project number, taken from the OAuth client id.
 *
 * Google formats client ids as `<project-number>-<random>.apps.googleusercontent.com`,
 * and the picker needs that number as its app id. Deriving it removes a config
 * value that has to match exactly and fails silently when it does not: a wrong
 * number is still a number, so the picker returns a file id and no grant, and
 * the only symptom is a 404 from Sheets much later.
 */
export function getProjectNumber(): string | null {
  // Falls back to the env var: with a stored token the app renders as
  // authenticated on its first pass, before the effect that calls initAuth has
  // run, so `clientId` is not populated yet.
  const id = clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const match = /^(\d+)-/.exec(id);
  return match ? match[1] : null;
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

function requestWithConsent(resolve: (token: string) => void, reject: (err: Error) => void) {
  if (!clientId) {
    reject(new Error('Auth not initialized'));
    return;
  }
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
  // Clear local state FIRST. `google` only exists once the GIS script has
  // loaded, and revoking would throw a ReferenceError if it hasn't — offline in
  // the installed PWA, or with accounts.google.com blocked. Signing out must
  // never leave a live token behind just because revocation was unreachable.
  const token = accessToken;
  clearStoredToken();
  onAuthChange?.(false);

  try {
    if (token) google.accounts.oauth2.revoke(token, () => {});
  } catch {
    // GIS unavailable — the token is already gone locally and will expire.
  }
}
