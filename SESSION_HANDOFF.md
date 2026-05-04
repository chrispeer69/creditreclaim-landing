# Session Handoff — 2026-05-04

This document captures what landed in the last working session and what should
come next. Source of truth for the broader roadmap is
`docs/CREDITRECLAIM_PLATFORM_BUILD_PLAN.docx`; this file just maps the recent
deltas onto that plan and flags drift.

---

## 1. What was built — mapped to the build plan's phases

The build plan defines 9 phases:

| Phase | Plan name                      | Weeks  |
|-------|--------------------------------|--------|
| 1     | Auth (Registration & Login)    | 1–3    |
| 2     | Dashboard                      | 4–7    |
| 3     | Dispute Management             | 8–10   |
| 4     | Letter Generation              | 11–13  |
| 5     | Stripe Payments → MVP Beta     | 14–16  |
| 6     | Email Automation               | 17–20  |
| 7     | B2B Features                   | 21–24  |
| 8     | GHL Sync                       | 25–26  |
| 9     | QA → Public Launch             | 27–28  |

The last session shipped commit `7fc3ba2` on `main`, "Phase 2.1: Hero dashboard
with real Supabase data." The work straddles two phases:

- **Phase 2 (Dashboard):** Hero view at `/dashboard` — score + delta, items
  removed, disputes won, active disputes table, recommended-letters panel,
  recent responses, recommendations panel, and a Managed-only activity log.
- **Phase 3 (Dispute Management) — partial:** Dispute detail page at
  `/dashboard/dispute/[id]` — status timeline, dates, notes, response history,
  DIY-only "Mark letter sent" action that writes back to Supabase. This is the
  beginning of Phase 3, not the whole thing.
- **Phase 1 (Auth) — small follow-up fix:** Login and signup now persist the
  Supabase session via `setSession()` after the API route returns it. Without
  this, the dashboard's `getSession()` returned `null` and there was no way to
  reach an authenticated state from the existing flow.

### Stack drift from the build plan — flag for future contributors

The plan specifies Next.js 14, NextAuth.js, PostgreSQL via Prisma, Brevo for
email, Vercel + Railway for hosting. The repo currently runs:

- **Next.js 16.2.4** (not 14) — see `AGENTS.md`: "This is NOT the Next.js you
  know." Read `node_modules/next/dist/docs/` before writing Next-specific code.
- **Supabase** for both Auth and Postgres (no NextAuth, no Prisma).
- **No email layer yet.**
- **Hosting target unspecified** — no `vercel.json`, no `Dockerfile`, no
  `railway.toml`, no `Procfile`.

If you want to align back to the plan's stack, that's a deliberate decision,
not a small one. If you want to formalize the current stack as the new plan,
update `docs/CREDITRECLAIM_PLATFORM_BUILD_PLAN.docx`.

---

## 2. Files created or modified — one line each

**Created:**

- `lib/hooks/useDashboardData.ts` — `useDashboardData()` and
  `useDisputeDetail(id)` hooks; fetch user_credits / disputes / responses /
  recommendations from Supabase, scoped to current auth user.
- `app/dashboard/dispute/[id]/page.tsx` — dispute detail page with status
  timeline, response history, DIY "mark letter sent" action.
- `PHASE_2_1_DASHBOARD_SPEC.md` — the spec the dashboard was built against
  (schema + section list + DIY/Managed split).

**Modified:**

- `app/dashboard/page.tsx` — replaced 8-line "Phase 1" stub with the full
  hero dashboard (516 lines).
- `app/login/page.tsx` — added `supabase.auth.setSession(session)` after the
  login API returns, so the session actually persists in the browser.
- `app/signup/page.tsx` — same `setSession()` addition; no-ops gracefully if
  email confirmation is enabled and the API returns `session: null`.

---

## 3. Dependencies added to `package.json`

**None.** Everything imports from `@supabase/supabase-js` which was already a
dependency. No new packages were installed.

---

## 4. Env vars added to `.env.example`

**None — and there is no `.env.example` in this repo.** Only `.env.local`
exists, and it currently holds placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

Until those `your_*` placeholders are replaced with real values, the Supabase
client throws at module load and every page that imports `@/lib/supabase`
returns 500. That includes the new dashboard.

The dashboard does not require any env vars beyond the two
`NEXT_PUBLIC_SUPABASE_*` already listed.

---

## 5. Verified vs. untested

**Verified working:**

- TypeScript compiles cleanly (`tsc --noEmit` exits 0).
- File structure matches Next.js 16 app-router conventions (route under
  `app/dashboard/dispute/[id]/page.tsx`, client components carry `'use client'`).
- Existing pages still type-check after the `setSession` additions.

**Not verified at runtime:**

- Nothing in this commit was tested against a real Supabase instance. The
  `.env.local` placeholders cause `createClient()` to throw on module load, so
  hitting `/dashboard` returns 500. To actually run the feature you must:
  1. Replace `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     in `.env.local` with real project values.
  2. Run the SQL block from `PHASE_2_1_DASHBOARD_SPEC.md` in the Supabase
     SQL Editor to create `user_credits`, `disputes`, `responses`,
     `recommendations`.
  3. Sign up via `/signup`, then manually insert a `user_credits` row for the
     new auth user (the dashboard does not yet bootstrap one — see §6).
  4. Hit `/dashboard`.
- The "Mark letter sent" mutation has not been observed against a real DB.
- DIY vs. Managed branching has not been visually confirmed in a browser; the
  tier check reads `user_credits.tier` and switches several panels, but no
  one has clicked through both states.
- Mobile layout has not been tested in a real device or devtools emulator —
  it uses Tailwind's `sm:` / `lg:` breakpoints and is mobile-first by
  construction, but verification is owed.
- No RLS policies are defined on the four new tables. With Supabase's anon
  key, queries currently rely on Postgres permissions alone. **Before any
  multi-user testing, RLS must be enabled with `auth.uid() = user_id`
  policies on all four tables.** This was deliberately left out of the spec
  scope but should not ship to real users without it.

---

## 6. Next 1–2 logical sub-phases

### Phase 2.2 — Bootstrap & dispute creation (recommended next)

The Phase 2.1 dashboard renders correctly but has nothing to display until
data exists. Two gaps to close:

1. **`user_credits` row bootstrap.** Currently the dashboard expects a row
   keyed by `auth.uid()`. Either:
   - Auto-insert on first dashboard load (idempotent upsert with default
     `current_score = 600`), or
   - Add an onboarding step after `/tier-selection` that asks the user for
     their starting score and tier, then inserts the row.
   The second is cleaner — initial score is meaningful baseline data.
2. **Dispute creation form** at `app/dashboard/dispute/new/page.tsx`.
   Without it the user can never get past "No active disputes." Form
   fields map to the `disputes` schema: creditor name, account number,
   dispute type (enum dropdown), notes. Status defaults to `'draft'`.
   The new dispute then appears in the "Recommended letters" panel and
   the user can drill into the detail page to mark it sent.

This sub-phase finishes Phase 2 by making the dashboard actually usable.

### Phase 2.3 / Phase 3 lead-in — Status automation + RLS hardening

Once data flows through, two follow-ups to make the dashboard trustworthy:

1. **Auto-transition `sent → in_review` after 30 days.** Either via a
   Supabase scheduled function (pg_cron / pg_net) or a Next.js server-side
   cron via `app/api/cron/age-disputes/route.ts`. The "Recommendations" panel
   was sized to surface SOL expirations and age-offs — without this nothing
   ever ages.
2. **Enable RLS on all four new tables** with `auth.uid() = user_id`
   policies (and `auth.uid() = id` for `user_credits`). This is a hard
   prerequisite before any second user signs up — otherwise every user can
   read every other user's disputes via the anon key.

After these two land, Phase 3 (Dispute Management) is roughly half done and
the work shifts to Phase 4 (Letter Generation) — generating the actual letter
PDF/text content that the user prints and mails.

---

## Repo state at handoff

```
Branch:  main
HEAD:    7fc3ba2 Phase 2.1: Hero dashboard with real Supabase data
Status:  clean, in sync with origin/main
```
