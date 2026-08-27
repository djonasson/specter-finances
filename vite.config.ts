import { cpus } from 'node:os';
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
    /**
     * Half the cores, and never more than six.
     *
     * Not a sacrifice for the sake of the desktop: uncapped, this machine's
     * twenty cores ran the suite in 14.7s at 1385% CPU, and six workers run it
     * in 13.3s at 881% — faster *and* a third less work, because past that
     * point the workers mostly contend. Four is 15.4s at 587%, which is the
     * trade if a machine needs to stay responsive for something else.
     *
     * The floor of two matters on a small machine, where half of two cores is
     * one and a single worker runs every file in series.
     */
    maxWorkers: Math.max(2, Math.min(6, Math.floor(cpus().length / 2))),
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
