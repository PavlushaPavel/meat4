import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// base НЕ задаётся здесь: путь публикации (/meat4/) — свойство деплоя, а не
// исходников. Его передаёт флагом сборки .github/workflows/deploy.yml, взяв имя
// репозитория, — поэтому форк публикуется по своему адресу без правок кода.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    css: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
