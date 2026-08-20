import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    open: true,
    // 局域网/本地共用：将 /api 代理到本机后端 3000，
    // 前端使用相对路径 /api，无需硬编码后端 IP，也不会触发 CORS。
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'dnd': ['@hello-pangea/dnd'],
          'utils': ['date-fns', 'nanoid', 'clsx', 'lucide-react'],
        },
      },
    },
  },
});
