import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Absolute base matching the deployed path. This page is reached via a
// vercel.json rewrite to /tools/blur-lab/dist/index.html while the browser's
// address bar stays at /tools/blur-lab (no trailing slash, per this site's
// global trailingSlash:false) — a relative base would resolve assets against
// /tools/ instead of /tools/blur-lab/dist/, so it has to be absolute.
export default defineConfig({
  base: '/tools/blur-lab/dist/',
  plugins: [react()],
});
