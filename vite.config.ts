import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.GITHUB_ACTIONS ? '/specter-finances/' : '/';

export default defineConfig({
  base,
  test: {
    // Service tests stay in node; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock so the fast suite stays fast.
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-squirrel.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Specter Finances',
        short_name: 'Finances',
        description: 'Shared expense tracker',
        theme_color: '#6366f1',
        background_color: '#111218',
        display: 'standalone',
        start_url: base,
        icons: [
          {
            src: `${base}icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${base}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${base}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});
