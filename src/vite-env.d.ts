/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SPREADSHEET_ID: string;
  readonly VITE_SHEET_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Identity Services types
declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
    prompt?: string;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;

  function revoke(token: string, callback: () => void): void;
}
