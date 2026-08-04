// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { FOOTER_HEIGHT, footerHeight } from './chrome';

afterEach(() => {
  document.body.replaceChildren();
});

function mountFooter(height: number | null) {
  const footer = document.createElement('div');
  footer.className = 'mantine-AppShell-footer';
  if (height !== null) {
    footer.getBoundingClientRect = () => ({ height }) as DOMRect;
  }
  document.body.append(footer);
}

// A scene that draws over the app stands on the footer, and the floor that masks
// it is positioned from the same edge. Getting this number wrong does not throw
// — it silently puts the scene's ground behind the navigation bar.

describe('finding the footer', () => {
  it('measures the footer the layout actually rendered', () => {
    mountFooter(72);
    expect(footerHeight()).toBe(72);
  });

  it('falls back to the configured height when there is no footer at all', () => {
    // The sign-in screen renders no AppShell.
    expect(footerHeight()).toBe(FOOTER_HEIGHT);
  });

  // jsdom reports zero, and so does a real browser before first layout. Taken at
  // face value it drops the scene's ground to the very bottom of the window.
  it('falls back when the footer is there but has not been laid out yet', () => {
    mountFooter(0);
    expect(footerHeight()).toBe(FOOTER_HEIGHT);
  });
});
