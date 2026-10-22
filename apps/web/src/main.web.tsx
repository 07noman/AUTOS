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

// Deployment trigger v0.1.6: Business pos & store rename, store icon, zero-fouc hidden modules, universal receipt branding

// Tauri browser mock — lets SQLite repos fall back to localStorage in browser
import { setupTauriBrowserMock } from '@/lib/tauri-mock';

// PWA install prompt support
import { setupPwaInstall } from '@/services/pwaInstall';

// Initialize Tauri browser compatibility shim (no-op when real Tauri is present)
setupTauriBrowserMock();

// Setup PWA install banner listener
setupPwaInstall();

// Clean up any stale service workers or caches from previous desktop/PWA builds
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}

// Initialize database before rendering
// In the browser, this runs via tauri-mock → localStorage.
// When Supabase is configured (VITE_SUPABASE_URL), auth & data use the real API.
import { initializeDatabase } from '@/lib/db';
import { clearOfflineOrdersQueue } from '@/services/offlineOrders';

// Clear any stale offline orders queue to prevent duplicate sync on startup
void clearOfflineOrdersQueue();

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

    // NOTE: React.StrictMode is intentionally omitted in web/production build
    // to prevent double-mounting, duplicate effect calls, and duplicated order submits
    // during cold starts on Vercel.
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <QueryClientProvider client={queryClient}>
        {/* BrowserRouter for clean URLs on Vercel (no hash routing) */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );
  });
