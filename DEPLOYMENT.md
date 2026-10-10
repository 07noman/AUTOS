# GENX Cloud POS — Vercel + Supabase Deployment Guide

## Architecture Overview

```
apps/
  desktop/   ← Tauri + SQLite (offline-first desktop .exe) — PRESERVED
  web/       ← Browser SPA for Vercel deployment (NEW)
  api/       ← Fastify backend (optional — auth/sync)
```

The `apps/web` package **shares all React source code** from `apps/desktop/src` via a Vite alias.
No code is duplicated. The desktop app is completely unmodified.

---

## Git Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable baseline (pushed to GitHub) |
| `backup/desktop-offline-before-web-deployment` | ✅ Snapshot of desktop/offline system before web changes |
| `feature/online-web-deployment` | Current — web deployment work |

---

## Prerequisites

1. **Supabase project** — https://supabase.com (free tier works)
2. **Vercel account** — https://vercel.com (free tier works)
3. **Node.js >= 20** and **pnpm >= 8**

---

## Step 1: Configure Supabase

### 1.1 Create a Supabase Project
1. Go to https://app.supabase.com → New Project
2. Note your **Project URL** and **anon public key** from Settings → API

### 1.2 Run the Database Schema
In Supabase SQL Editor, run this to set up auth-related user metadata:

```sql
-- Allow users to set their tenant_id in user_metadata on signup
-- (Supabase auth handles this automatically via the signup data field)

-- Optional: If you want a users/tenants table in Supabase (in addition to auth.users):
-- The app works with Supabase auth.users directly; no extra tables needed for MVP.
```

### 1.3 Configure Email Auth
1. Go to Authentication → Providers → Email
2. Enable **Email** sign-in
3. Optionally disable **Confirm email** for development (enable for production)

### 1.4 Create a Test User
```
Authentication → Users → Invite User
Email: your@email.com
Password: (set via "Send recovery email" flow or the API)
```

Or use the SQL Editor:
```sql
-- Supabase creates auth users via the API, not direct SQL.
-- Use the Dashboard: Authentication → Users → Add User
```

---

## Step 2: Set Up Local Development

```bash
# Clone and install
git clone https://github.com/07noman/Pos-stores-
cd "Pos-stores-"
pnpm install

# Create web env file
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env and fill in your Supabase URL and anon key

# Run web app locally (port 3001)
pnpm dev:web
```

The browser will open at http://localhost:3001.

---

## Step 3: Deploy to Vercel

### Option A: GitHub Integration (Recommended)

1. Push this branch to GitHub:
   ```bash
   git push origin feature/online-web-deployment
   ```

2. Go to https://vercel.com/new → **Import Git Repository** → select `07noman/Pos-stores-`

3. In Vercel project settings:
   - **Framework Preset**: Other
   - **Build Command**: `pnpm --filter web build`
   - **Output Directory**: `apps/web/dist`
   - **Install Command**: `pnpm install`

4. Add **Environment Variables** in Vercel Dashboard:
   ```
   VITE_SUPABASE_URL     = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key
   VITE_APP_VERSION      = 1.0.0
   ```
   > ⚠️ Never paste API keys directly in code or commit them to git.

5. Click **Deploy** — Vercel will build `apps/web` and serve it globally.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel --cwd . login
vercel --cwd . deploy --prod
```

---

## Step 4: Configure Supabase CORS

In Supabase → Authentication → URL Configuration:
- **Site URL**: `https://your-project.vercel.app`
- **Redirect URLs**: `https://your-project.vercel.app/**`

---

## How It Works

### Authentication Flow
1. User enters email/password on the Login page
2. `useAuth.ts` tries **Supabase auth** first (if `VITE_SUPABASE_URL` is set)
3. If Supabase auth succeeds → user is authenticated with a real JWT
4. If Supabase is unreachable → falls back to **offline credential cache** (localStorage)

### Data Flow (Web)
- All POS operations (products, orders, customers) use the **Tauri browser mock** backed by **localStorage**
- When `VITE_API_URL` is set, the `SyncEngine` pushes changes to the backend
- The desktop app uses real SQLite; the web uses the same repo API via localStorage mock

### What `apps/web` Contains
```
apps/web/
  src/
    main.web.tsx       ← Web entry point (BrowserRouter, no Tauri SW)
  index.html
  vite.config.ts       ← Aliases @ → apps/desktop/src
  tsconfig.json
  tailwind.config.js
  postcss.config.js
  public/
    manifest.json      ← PWA manifest
    favicon.svg
  .env.example         ← Template (real .env is gitignored)
```

**All React pages, hooks, stores, and components** live in `apps/desktop/src` and are shared.

---

## Desktop Build (Preserved)

The desktop `.exe` build is **completely unaffected**:

```bash
# Desktop dev (Tauri window)
pnpm dev:desktop

# Desktop production build
pnpm build:desktop
# Then: cd apps/desktop && pnpm tauri build
```

The `apps/desktop/src-tauri/` folder is untouched and still builds normally.

---

## Compatibility Notes

| Feature | Web (Vercel) | Desktop (Tauri) |
|---------|-------------|-----------------|
| Authentication | Supabase JWT | Supabase JWT + offline cache |
| Database | localStorage (via tauri-mock) | SQLite via Tauri plugin |
| Sync | SyncEngine → API | SyncEngine → API |
| Offline support | Browser cache (PWA) | Full SQLite offline |
| Printing | Browser print dialog | Native print |
| Auto-updates | Vercel deploy | Tauri updater |

---

## Security Notes

- `.env` files are gitignored — never committed
- Supabase anon key is safe to expose in the browser (Row-Level Security enforces tenant isolation)
- The API server uses JWT validation for all protected routes
- CORS is restricted in production
