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
    requestAccessToken(): void;
  }

  interface TokenResponse {
    access_token: string;
    expires_in: number;
    error?: string;
  }

  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }): TokenClient;

  function revoke(token: string, callback: () => void): void;
}
