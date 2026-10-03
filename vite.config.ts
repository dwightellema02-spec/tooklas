import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '~': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('/node_modules/')) {
              if (normalizedId.includes('katex')) {
                return 'vendor-katex';
              }
              if (normalizedId.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (normalizedId.includes('motion')) {
                return 'vendor-motion';
              }
              if (normalizedId.includes('react') || normalizedId.includes('react-dom')) {
                return 'vendor-react';
              }
              return 'vendor';
            }
            if (normalizedId.includes('/src/app/teacher/research/')) {
              return 'feature-research';
            }
            if (normalizedId.includes('/src/app/teacher/students/') && normalizedId.includes('/insights/')) {
              return 'feature-insights';
            }
          },
        },
      },
    },
  };
});
