import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedSrc = path.resolve(dirname, '../../packages/shared/src');

/**
 * Vite configuration.
 *
 * Two decisions worth calling out:
 *  - `loadEnv` is used (not `process.env`) so variables from `.env` files are
 *    validated identically in dev and in `vite build`.
 *  - `@voiceflow/shared` is aliased to its TypeScript **source**, not to the
 *    built package. The shared package emits CommonJS so NestJS can require it,
 *    and Rollup cannot see named exports through TypeScript's `__exportStar`
 *    re-export helper — building against `dist` fails with
 *    `"X" is not exported by .../dist/index.js`. Compiling the source gives Vite
 *    statically analysable ESM and working tree-shaking.
 *    `tsconfig.app.json` maps the same path so types and runtime can never
 *    disagree; the API keeps consuming the built CommonJS artefact.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, 'VITE_');

  const apiTarget = env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:4000';

  return {
    envDir: dirname,
    plugins: [react()],
    resolve: {
      alias: {
        '@voiceflow/shared': sharedSrc,
        '@': path.resolve(dirname, 'src'),
      },
    },
    css: {
      devSourcemap: true,
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        // Keeps the browser same-origin in development, so cookies and CORS
        // behave exactly as they will in production behind a reverse proxy.
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // Fail the build if a chunk regresses materially rather than silently
      // shipping a larger bundle than the last release.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  };
});
