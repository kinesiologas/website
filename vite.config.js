import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  plugins: [react(), tailwindcss()],
});
