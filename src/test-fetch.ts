import { vi } from 'vitest';

/**
 * A fake `fetch`, shared by the tests of everything that talks to Google.
 *
 * It lives here rather than in each suite because the thing it fakes decides
 * whether the app keeps the user's spreadsheet grant: `ok` and `status` are read
 * by the branch that drops it. Three copies of that judgement drifting apart is
 * how a test suite comes to disagree with itself about what a 403 means.
 *
 * Kept out of `test-utils.tsx` deliberately — that module pulls in React and
 * Mantine, and nothing here needs a DOM.
 */
export interface FakeResponse {
  /** Defaults to 200. */
  status?: number;
  /** What `json()` resolves to. */
  body?: unknown;
  /** What `blob()` resolves to, for the calls that answer with a file. */
  blob?: Blob;
}

export interface FetchCall {
  url: string;
  options: RequestInit;
}

/** Queue of responses, one per fetch call, in order. Returns the calls made. */
export function mockFetchQueue(responses: FakeResponse[]): FetchCall[] {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string, options: RequestInit = {}) => {
    calls.push({ url, options });
    const next = responses[i++] ?? {};
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => next.body ?? {},
      blob: async () => next.blob ?? new Blob([]),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

/** Every request URL, decoded, so ranges can be matched as written. */
export function urls(calls: { url: string }[]): string[] {
  return calls.map((c) => decodeURIComponent(c.url));
}

/** Parse the JSON body a mutation sent. */
export function bodyOf(call: { options: RequestInit }): Record<string, unknown> {
  return JSON.parse(call.options.body as string);
}
