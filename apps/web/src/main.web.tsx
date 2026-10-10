/**
 * Web Entry Point — GENX Cloud POS (Browser / Vercel Deployment)
 *
 * Key differences from apps/desktop/src/main.tsx:
 *  1. Uses BrowserRouter (clean URLs for Vercel) instead of HashRouter.
 *  2. Skips Tauri-only service worker registration (sw.js).
 *  3. Sets up the Tauri browser mock so SQLite repos work in the browser
 *     (backed by localStorage) when Supabase/API is unreachable.
 *  4. No desktop-specific Tauri initialization.
 *
 * The full App component, routes, features, hooks, and stores are
 * imported directly from apps/desktop/src — zero duplication.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Shared App + styles from desktop (via @ alias → apps/desktop/src)
import App from '@/App';
import '@/index.css';

// Tauri browser mock — lets SQLite repos fall back to localStorage in browser
import { setupTauriBrowserMock } from '@/lib/tauri-mock';

// PWA install prompt support
import { setupPwaInstall } from '@/services/pwaInstall';

// Initialize Tauri browser compatibility shim (no-op when real Tauri is present)
setupTauriBrowserMock();

// Setup PWA install banner listener
setupPwaInstall();

// NOTE: We intentionally do NOT register sw.js here.
// The desktop app registers a service worker for offline-first Tauri shell caching.
// The web version relies on Vercel's edge CDN and Supabase for availability.

// Initialize database before rendering
// In the browser, this runs via tauri-mock → localStorage.
// When Supabase is configured (VITE_SUPABASE_URL), auth & data use the real API.
import { initializeDatabase } from '@/lib/db';

initializeDatabase()
  .catch((err) => {
    console.warn('[web] Database init warning (browser mode):', err);
  })
  .finally(() => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60, // 1 minute
          retry: 1,
        },
      },
    });

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          {/* BrowserRouter for clean URLs on Vercel (no hash routing) */}
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </React.StrictMode>
    );
  });
