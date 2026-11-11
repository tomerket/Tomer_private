# Screening Room

A private video platform with two sides: a **public viewer site** and a **creator studio**. It looks and feels like a premium streaming product: near-black, tight typography, and one warm amber accent for anything live, playing or yours.

We build no video infrastructure ourselves. ImageKit stores the videos, streams them at the right quality, makes the thumbnails, and supplies the player. Supabase handles accounts and data. This codebase is only the product around those two services.

> How it was built and which tools were used: [HOW_IT_WAS_BUILT.md](HOW_IT_WAS_BUILT.md)
> The original milestone plan and every later change: [plan.md](plan.md)
> The design system (colours, type, card anatomy): [design-system/screening-room/MASTER.md](design-system/screening-room/MASTER.md), live at `/design`

---

## What you can do

### As a viewer
- **Browse the home feed:** a dense grid of thumbnails. Each card shows the title, channel, view count, how long ago it was published, and a timecode duration badge. A thin amber bar slides in on hover.
- **Watch videos** in the ImageKit player:
  - Adaptive streaming (360p to 1080p, picked for your connection)
  - AI-generated chapters
  - Frame previews when you hover the progress bar
  - A floating mini-player when you scroll down
- **Up next sidebar:** the latest videos, or, inside a playlist, the playlist in order, with the next video starting automatically.
- **Playlists:** browse published playlists and press "Play all".
- **Like or dislike, subscribe to channels, and comment** (signed in). Counts are visible to everyone.
- **Subscriptions:** new videos from the channels you follow.
- **History:** videos you've watched, grouped by day.
- **Members-only videos:** these show a lock. Only members (and the owner) can play them; everyone else sees a sign-in or members gate.
- **Sign in** with a password, or with a one-time link sent by email.

### As a creator (Studio)
- **Upload:** drag and drop several videos at once, with progress bars, cancel and retry. Uploads go straight to ImageKit and start as unpublished drafts.
- **Manage videos:**
  - Edit the title and description.
  - **Pick a thumbnail frame:** choose from 8 suggested frames or scrub to the exact second.
  - Add the video to playlists.
- **One-click Publish / Unpublish** and a **Members-only** switch on every video.
- **Playlists:** create, rename, publish and delete them, and reorder by drag or arrows.
- **Analytics:**
  - Channel page: views, watch time, subscribers, likes and comments; a 28-day views chart; a table of your videos with average percentage watched.
  - Click any video for its own page with views-per-day and watch-time-per-day charts.
  - Only you can see your channel's analytics.

### Demo data
A script creates 4 demo channels, 10 demo videos and 10 demo viewers, with a month of views, watch time, likes, comments and subscriptions, so the feed and analytics have something to show. One command removes all of it (see below).

---

## Pages

| Page | URL |
|---|---|
| Home feed | `/` |
| Watch | `/watch/[id]` (`?list=[playlistId]` for playlist mode) |
| Playlists | `/playlists`, `/playlist/[id]` |
| Subscriptions | `/subscriptions` |
| History | `/history` |
| Sign in | `/login` |
| Studio: videos, upload, playlists, analytics | `/studio`, `/studio/upload`, `/studio/playlists`, `/studio/analytics` |
| Video analytics | `/studio/analytics/[id]` |
| Design system style tile | `/design` |

---

## Run it locally

**Needs:** Node.js 20+, a Supabase project, and an ImageKit account.

1. Install dependencies:
   ```bash
   cd web_app_video_try1
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_IMAGEKIT_ID`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only the local scripts use it, never the app)
   - `REVALIDATE_SECRET` (any long random string)
3. Apply the database migrations in `supabase/migrations/` in order (0001 → 0006).
4. Start the app:
   ```bash
   npm run dev                 # http://localhost:3000
   npm run dev -- -H 0.0.0.0   # also reachable from your phone at http://<computer-IP>:3000 (same Wi-Fi)
   ```
5. Make your account the creator. Sign up once at `/login`, then run this in the Supabase SQL editor:
   ```sql
   update profiles set role = 'creator' where id = (select id from auth.users where email = 'you@example.com');
   ```

### Helper scripts
```bash
node --env-file=.env.local scripts/set-password.mjs you@example.com     # set a password (no email needed)
node --env-file=.env.local scripts/dev-login-link.mjs you@example.com   # print a one-time sign-in link
node --env-file=.env.local scripts/seed-demo.mjs                        # add demo channels and activity
node --env-file=.env.local scripts/seed-demo.mjs --clean                # remove all demo data
```

### Members-only protection at the media level (optional)
In the ImageKit dashboard, go to Settings → Videos → Restrict unsigned URLs → "Restrict all requests". Then set `NEXT_PUBLIC_IMAGEKIT_SIGNED_DELIVERY=true`. From then on every video, thumbnail and stream URL is signed by `/api/sign`, which only signs files the viewer is allowed to watch.

---

## Project layout

```
app/                 pages and routes (viewer site, /studio, /api/sign, /api/imagekit/auth)
components/          VideoCard, Player (ImageKit wrapper), Sidebar, UI controls
lib/                 Supabase clients, auth, catalog and engagement data, ImageKit helpers
supabase/migrations/ database schema, access rules (RLS), counters and analytics functions
scripts/             demo seed, password and login-link helpers
design-system/       design spec (MASTER.md)
plan.md              milestone plan and change log
```

## Notes
- **Browser support:** use Chrome, Edge or Safari. VS Code's built-in preview browser can't decode H.264 video.
- **Sign-in emails:** Supabase's built-in sender allows only about 2 emails per hour. Use password sign-in, or connect your own SMTP sender in Supabase (Authentication → Emails).
- **Analytics source:** views and watch time come from our own database. ImageKit's built-in player analytics is an Enterprise feature; set `NEXT_PUBLIC_PLAYER_ANALYTICS=true` if your plan includes it.
