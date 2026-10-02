import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, defaultClientConditions, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // /api and uploaded photos (/media) come from the API
  const target = env.API_PROXY_TARGET ?? 'http://localhost:4000';
  const proxy = { '/api': { target, changeOrigin: false }, '/media': { target, changeOrigin: false } };
  // Seeded species photos (/images/...) are files of the public site
  const images = (fallback: string) => ({ '/images': { target: env.WEB_PROXY_TARGET || fallback, changeOrigin: false } });
  return {
    plugins: [react(), tailwindcss()],
    resolve: { conditions: ['source', ...defaultClientConditions] },
    server: { port: 5174, strictPort: true, proxy: { ...proxy, ...images('http://localhost:5173') } },
    preview: { port: 4174, strictPort: true, proxy: { ...proxy, ...images('http://localhost:4173') } },
    build: { target: 'es2020', sourcemap: true },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      // Component tests type into forms; slower CI runners need more than the 5 s default
      testTimeout: 15_000,
      include: ['src/**/*.test.{ts,tsx}'],
      env: { VITE_API_URL: 'http://localhost' },
    },
  };
});
