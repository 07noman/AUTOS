import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initializeDatabase } from './lib/db';
import { setupTauriBrowserMock } from './lib/tauri-mock';
import { setupPwaInstall } from './services/pwaInstall';

// Enable browser fallback for SQLite if not running inside Tauri
setupTauriBrowserMock();

// Setup PWA installation listener
setupPwaInstall();

// Register Service Worker for offline app shell
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('ServiceWorker registered with scope:', reg.scope);
      })
      .catch((error) => {
        console.warn('ServiceWorker registration error:', error);
      });
  });
}

// Initialize database before rendering app
initializeDatabase()
  .catch((err) => {
    console.warn('Database initialization warning (running without Tauri?):', err);
  })
  .finally(() => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60,
          retry: 1,
        },
      },
    });

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    );
  });
