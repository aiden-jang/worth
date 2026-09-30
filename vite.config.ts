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
            config:
              command === 'serve'
                ? (config) => ({ vars: { ...config.vars, AUTH_URL: 'http://localhost:34100' } })
                : undefined,
          }),
        ],
  server: { port: 34300 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
}));
