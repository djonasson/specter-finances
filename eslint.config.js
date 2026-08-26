import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', '.remember']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    /**
     * How big the window is gets asked in one place.
     *
     * Three bugs in a row came from changing where one of these was read and
     * not finding every other reader: the canvas fitted to the viewport while
     * its resize guard still compared the window, so the guard never fired; the
     * band reserved for the scenery measured differently from the scenery; and
     * the height taken from the layout viewport, which does not move when a
     * phone's URL bar does. Each was a grep somebody had to remember to run.
     * `theme/chrome.ts` owns these readings — `viewportSize`, `canvasPixelRatio`,
     * `footerHeight`, `headerHeight` — and this makes going round it a build
     * error instead.
     */
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/theme/chrome.ts',
      'src/**/*.test.{ts,tsx}',
      'src/test-utils.tsx',
      'src/test-setup.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'innerWidth',
          message: 'Ask theme/chrome.ts — viewportSize().width.',
        },
        {
          name: 'innerHeight',
          message: 'Ask theme/chrome.ts — viewportSize().height.',
        },
        {
          name: 'devicePixelRatio',
          message: 'Ask theme/chrome.ts — canvasPixelRatio(), which also caps it.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'innerWidth',
          message: 'Ask theme/chrome.ts — viewportSize().width.',
        },
        {
          object: 'window',
          property: 'innerHeight',
          message: 'Ask theme/chrome.ts — viewportSize().height.',
        },
        {
          object: 'window',
          property: 'devicePixelRatio',
          message: 'Ask theme/chrome.ts — canvasPixelRatio(), which also caps it.',
        },
        {
          property: 'clientWidth',
          message: 'Ask theme/chrome.ts — viewportSize().width.',
        },
        {
          property: 'clientHeight',
          message: 'Ask theme/chrome.ts — viewportSize().height.',
        },
        {
          property: 'getBoundingClientRect',
          message: "Measuring the app's chrome belongs in theme/chrome.ts.",
        },
      ],
    },
  },
]);
