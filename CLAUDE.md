# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack internship application tracker. Users log internship applications, track their status, add notes, and get an at-a-glance view of their pipeline.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Auth + Realtime) · Vercel (deployment) · TypeScript · Tailwind CSS v4 · shadcn/ui (Nova preset)

**Status:** Scaffolded. Auth pages, dashboard, and all core components are built. Pending: Supabase credentials in `.env.local` and running the DB migration against your Supabase project.

## Bootstrap (first-time setup)

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
npm install @supabase/ssr @supabase/supabase-js
npx supabase init
npx shadcn@latest init
cp .env.example .env.local   # then fill in Supabase URL + anon key
```

## Common Commands

```bash
# Development
npm run dev           # Start dev server at localhost:3000
npm run build         # Production build
npm run lint          # ESLint
npm run type-check    # tsc --noEmit

# Supabase local stack (requires Docker)
npx supabase start    # Start local Supabase (Postgres + Auth + Studio)
npx supabase stop
npx supabase db reset # Reset local DB and re-run all migrations
npx supabase gen types typescript --local > src/types/supabase.ts
npx supabase migration new <name>
npx supabase db push  # Push migrations to remote (prod)
```

## Architecture

### Next.js App Router layout

```
src/
  app/
    (auth)/           # Route group: login, signup — no nav shell
      login/
      signup/
    (dashboard)/      # Route group: protected pages with sidebar nav
      dashboard/      # Main kanban/list tracker view
      applications/   # CRUD for individual applications
    layout.tsx        # Root layout — Supabase session provider wraps here
  components/
    ui/               # shadcn/ui primitives (Button, Card, Dialog, etc.)
    features/         # Domain components (ApplicationCard, StatusBadge, etc.)
  lib/
    supabase/
      client.ts       # Browser client — createBrowserClient (singleton)
      server.ts       # Server client — createServerClient with cookies()
  types/
    supabase.ts       # Auto-generated — never hand-edit
  proxy.ts            # Next.js 16 proxy (replaces middleware.ts) — refreshes session; guards (dashboard) routes
```

### Supabase integration pattern

- **Server Components / Route Handlers:** import from `lib/supabase/server.ts` — it reads cookies via `next/headers`.
- **Client Components:** import from `lib/supabase/client.ts` — singleton browser client, safe to call repeatedly.
- **Auth flow:** email/password via Supabase Auth; `@supabase/ssr` keeps the JWT in cookies so Server Components can read it. `proxy.ts` (Next.js 16's replacement for `middleware.ts`) calls `supabase.auth.getUser()` on every request to refresh the token and guard protected routes.
- **Row-Level Security:** every table has RLS enabled. The only policy needed for user data is `auth.uid() = user_id`.
- **Type safety:** always import from `src/types/supabase.ts`; run `supabase gen types` after any schema change and commit the result.

### Data model

```sql
-- applications
id          uuid primary key default gen_random_uuid()
user_id     uuid references auth.users not null
company     text not null
role        text not null
status      text not null  -- 'wishlist' | 'applied' | 'oa' | 'interview' | 'offer' | 'rejected'
applied_date date
url         text
notes       text
created_at  timestamptz default now()
updated_at  timestamptz default now()
```

Enable RLS and add a single policy: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only; never expose to client
```

`.env.local` for local dev. Mirror these in Vercel project settings for production.

## Key conventions

- App Router only — no `pages/` directory.
- Default to Server Components; add `"use client"` only for interactivity or browser APIs.
- All DB reads/writes go directly through the Supabase client — no custom API layer. RLS is the security boundary.
- Migrations in `supabase/migrations/` are the schema source of truth — never mutate production DB directly.
- `updated_at` column: add a Postgres trigger (`moddatetime` extension) rather than setting it in application code.
