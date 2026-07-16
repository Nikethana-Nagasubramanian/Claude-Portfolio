import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the built index.html resolves assets relatively —
// this app is deployed nested under /tools/blur-lab/dist/, not site root.
export default defineConfig({
  base: './',
  plugins: [react()],
});
