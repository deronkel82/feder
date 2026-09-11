import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
import { licenseNotices } from './scripts/licenses';
export default defineConfig({
  base: './',
  plugins: [react(), licenseNotices()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'dist-pages' },
  server: { host: '127.0.0.1', watch: { usePolling: true } },
});
