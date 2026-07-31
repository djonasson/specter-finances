// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initAuth, getProjectNumber } from './auth';

// initAuth appends the GIS script and resolves on load/error; onerror is enough
// to settle it without a network, and clientId is captured before that.
function initWith(clientId: string) {
  const promise = initAuth(clientId);
  const script = document.head.querySelector('script[src*="gsi/client"]');
  script?.dispatchEvent(new Event('error'));
  return promise;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('getProjectNumber', () => {
  it('works before initAuth has run', () => {
    // The gate renders on the first pass when a stored token exists, which is
    // before AuthProvider's effect calls initAuth.
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '89909641639-abc.apps.googleusercontent.com');
    expect(getProjectNumber()).toBe('89909641639');
    vi.unstubAllEnvs();
  });

  it('takes the digits before the dash in the client id', async () => {
    await initWith('89909641639-oed4babc123.apps.googleusercontent.com');
    // Deriving this beats configuring it: a mistyped number is still a number,
    // so the picker returns a file id, creates no grant, and the only symptom
    // is a 404 from Sheets much later.
    expect(getProjectNumber()).toBe('89909641639');
  });

  it('returns null for something that is not a client id', async () => {
    await initWith('not-a-client-id');
    expect(getProjectNumber()).toBeNull();
  });
});
