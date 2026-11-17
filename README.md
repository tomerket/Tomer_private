# MyFamily

A family web app that works on phones, tablets and computers: daily tasks and rewards for the kids, a to-do list for the parents, a dashboard, a family calendar with reminders, and a shared shopping list.

**Live app:** https://myfamily-gules.vercel.app

React + Vite + Tailwind · Node/Express API · Supabase (Postgres, Auth, Storage) · Vercel.

| Document | For |
|---|---|
| In-app **Help** page (`/help`) | Family members: how to use every page |
| [REBUILD.md](REBUILD.md) | Rebuilding this app from scratch (full spec) |
| [PLAN.md](PLAN.md) | The original plan and design notes |

## What's in the app

- **Sign in:** the family admin uses email + password. Other members use family name + a parent's name + their name + birthday. Kids under 8 land on their tasks. Auto logout after 15 minutes idle.
- **Home:** family photo, members, and calendar reminders that are due.
- **Family Tasks:**
  - **Kids:** daily tasks by Morning / During the day / Evening, must-do tasks and per-day rewards.
  - **Parents:** tasks with dates, a parent assignee and a colour per parent.
  - **Dashboard:** charts, parents only.
- **Calendar:** month view, activities over one or more days, categories, a reminder date and time, a Next 10 list with Share, and birthdays.
- **Shopping List:** coloured columns per category, one product per line, tap to mark as bought, and delete one, bought, a category or all.
- **Settings** (admin): members and face photos, kids tasks and rewards.
- **Help:** instructions for everything above.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in.
   - `SUPABASE_SECRET_KEY`: Supabase Dashboard → Project Settings → API Keys → Secret keys.
   - `SESSION_SECRET`: any random string of 32+ characters.
3. `npm run dev`. The web app runs on http://localhost:3000 and the API on http://localhost:3001.

| Command | What it does |
|---|---|
| `npm run dev` | web + API with hot reload |
| `npm run build` | type-check and build to `dist/` |
| `npm run typecheck` | type-check only |

## Deployment (Vercel)

The app is the `MyFamily/` folder of the GitHub repo `tomerket/Tomer_private`. The Vercel project `myfamily` is connected to that repo, with **Root Directory = `MyFamily`** and the production branch `main`.

- **Every push to `main` deploys automatically** to https://myfamily-gules.vercel.app. Pushes that don't change `MyFamily/` are skipped (`ignoreCommand` in `vercel.json`).
- Pushes to other branches get their own preview link.
- Vercel serves the built `dist/` and runs `api/index.ts` (the Express app) for every `/api/*` request, in the Frankfurt region (`fra1`).
- To publish by hand instead: `vercel deploy --prod` from the repo root.

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Where it's used |
|---|---|
| `VITE_SUPABASE_URL` | browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser |
| `SUPABASE_URL` | server |
| `SUPABASE_SECRET_KEY` | server only, never in the browser or git |
| `SESSION_SECRET` | server only: signs the family-member login cookie |

### Supabase URL settings

In Supabase → Authentication → URL Configuration:

- **Site URL:** `https://myfamily-gules.vercel.app`
- **Redirect URLs:** `https://myfamily-gules.vercel.app/**` and `http://localhost:3000/**`

The confirmation email after registering sends the admin back to `/onboarding` on whichever of these sites they registered from.

## Database

- Schema changes live in `supabase/migrations/`, applied in order.
- Every table has RLS on with no policies. The browser can't read data directly, and all access goes through the API with the secret key.
- Storage buckets:
  - `family-photos`: private, served through signed links.
  - `task-images`: public, with random file names.
