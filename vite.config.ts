import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig(({ mode, command }) => ({
  plugins:
    mode === 'test'
      ? [react()]
      : [
          react(),
          cloudflare({
            // Visual QA uses an isolated local database, never a person's archive.
            persistState: process.env.WORTH_PREVIEW_STATE ? { path: process.env.WORTH_PREVIEW_STATE } : true,
            config:
              command === 'serve'
                ? (config) => ({ vars: { ...config.vars, AUTH_URL: 'http://localhost:34100' } })
                : undefined,
          }),
        ],
  // HTML entries belong only to the browser; Worker builds keep their own entry.
  environments: {
    client: { build: { rollupOptions: { input: { main: 'index.html', offline: 'offline/index.html' } } } },
  },
  server: { port: 34300 },
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    hookTimeout: 30_000,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
}));
