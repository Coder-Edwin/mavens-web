import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    // Keep a single React copy even though the monorepo root hoists another
    // version for unrelated tooling.
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5173,
    host: true
  }
});
