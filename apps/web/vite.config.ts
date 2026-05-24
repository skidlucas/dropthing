import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@uiw/react-codemirror')) return 'codemirror';
          if (id.includes('motion/react')) return 'motion';
        },
      },
    },
  },
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
});
