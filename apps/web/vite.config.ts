import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Web build — points to the shared desktop source tree.
// No Tauri plugin; tauri-mock.ts is loaded automatically by main.web.tsx.
export default defineConfig({
  plugins: [react()],
  // Read VITE_* vars from the root .env (shared with desktop)
  envDir: '../../',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || 'https://zqngkqsdpgtoytuleogn.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbmdrcXNkcGd0b3l0dWxlb2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMzI5NjgsImV4cCI6MjEwNjcwODk2OH0.zEP2fNgSNLQ-vnNDwfdYm6jsGyH2KomgMYku-okXhLY'
    ),
  },
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
