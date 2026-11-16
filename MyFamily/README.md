# MyFamily

Family web app (mobile-first): family setup, home with the family photo, and daily Family Tasks for kids and parents.

React + Vite + Tailwind · Node/Express API · Supabase · Vercel. See [PLAN.md](PLAN.md) for the design and data model.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. `SUPABASE_SECRET_KEY` is in Supabase Dashboard → Project Settings → API Keys → Secret keys. `SESSION_SECRET` is any random string of 32+ characters.
3. `npm run dev`. This starts the web app on http://localhost:3000 and the API on http://localhost:3001.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | web + API with hot reload |
| `npm run build` | type-check and build to `dist/` |
| `npm run typecheck` | type-check only |

## Deploy (Vercel)

Import the Git repo in Vercel, then add the same 5 variables from `.env.example` under Project → Settings → Environment Variables. Vercel serves `dist/` and runs `api/index.ts` for every `/api/*` request.

In Supabase → Authentication → URL Configuration, set **Site URL** to the Vercel URL and add it to **Redirect URLs**, so the email confirmation links work.

## Database

Schema changes live in `supabase/migrations/`. Tables have RLS on with no policies: the browser can't read data directly, and all access goes through the API with the secret key.
