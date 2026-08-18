import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths so the same build works on the web AND from file:// in the desktop app
  base: './',
  server: { port: 5175, strictPort: true },
  build: { chunkSizeWarningLimit: 1200 },
});
