import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'local-dev-csp',
      transformIndexHtml(html) {
        // Vite's local HMR preamble uses inline scripts; the production CSP stays strict.
        return command === 'serve'
          ? html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]+>/, '')
          : html;
      },
    },
  ],
  base: './',
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
