import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Absolute base matching the deployed path — same reasoning as blur-lab's
// vite.config.ts: this page is reached via a vercel.json rewrite while the
// browser's address bar stays at /tools/racked (no trailing slash), so a
// relative base would resolve assets against /tools/ instead of the actual
// dist folder.
export default defineConfig({
  base: '/tools/racked/dist/',
  plugins: [react()],
});
