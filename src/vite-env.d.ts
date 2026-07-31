/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'chroma-js';

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_SPREADSHEET_ID: string;
  readonly VITE_SHEET_NAME: string;
  /** Google API key, required by the file picker. */
  readonly VITE_GOOGLE_API_KEY: string;
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

// Google API loader (only the picker module is used)
declare namespace gapi {
  function load(name: string, config: { callback: () => void; onerror?: () => void }): void;
}

// Google Picker types
declare namespace google.picker {
  enum ViewId {
    SPREADSHEETS = 'spreadsheets',
  }

  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }

  interface ResponseObject {
    action: Action;
    docs?: { id: string; name?: string }[];
  }

  class DocsView {
    constructor(viewId: ViewId);
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
  }

  class Picker {
    setVisible(visible: boolean): void;
  }

  class PickerBuilder {
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    addView(view: DocsView): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setCallback(cb: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }
}
