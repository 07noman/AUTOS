import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Web build — points to the shared desktop source tree.
// No Tauri plugin; tauri-mock.ts is loaded automatically by main.web.tsx.
export default defineConfig({
  plugins: [react()],
  // Read VITE_* vars from the root .env (shared with desktop)
  envDir: '../../',
  resolve: {
    alias: {
      // Allow the web app to import everything from apps/desktop/src
      '@': path.resolve(__dirname, '../desktop/src'),
      // Stub the Tauri SQL plugin with a browser-compatible implementation.
      // The real desktop build uses the Rust Tauri plugin; web uses this stub
      // which routes through window.__TAURI_INTERNALS__ (set up by tauri-mock.ts).
      '@tauri-apps/plugin-sql': path.resolve(
        __dirname,
        './src/stubs/tauri-plugin-sql.ts'
      ),
    },
  },
  // Point Vite at the web-specific index.html in apps/web/
  root: path.resolve(__dirname),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    strictPort: false,
    open: true,
  },
});
