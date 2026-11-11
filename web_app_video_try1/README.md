# Screening Room

A private video platform with two sides: a **public viewer site** and a **creator studio**. It looks and feels like a premium streaming product: near-black, tight typography, and one warm amber accent for anything live, playing or yours.

We build no video infrastructure ourselves. ImageKit stores the videos, streams them at the right quality, makes the thumbnails, and supplies the player. Supabase handles accounts and data. This codebase is only the product around those two services.

> How it was built and which tools were used: [HOW_IT_WAS_BUILT.md](HOW_IT_WAS_BUILT.md)
> The original milestone plan and every later change: [plan.md](plan.md)
> The design system (colours, type, card anatomy): [design-system/screening-room/MASTER.md](design-system/screening-room/MASTER.md), live at `/design`
> How to open it on your computer or phone: [Open the app](#open-the-app-computer-and-phone)

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
- **Install as an app:** press **Install app** (next to your account in the top bar) to put Screening Room on your phone's home screen. It opens full screen, straight into the app. On iPhone the button shows the two Safari steps; on Android and desktop Chrome/Edge it opens the install prompt (needs HTTPS, see Notes).

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

## Open the app (computer and phone)

The app runs on your own computer, so that computer must be on with the server running (`npm run dev -- -H 0.0.0.0`, see above).

### On the computer
Open **http://localhost:3000** in Chrome, Edge or Safari.

### On your phone
1. Connect the phone to the **same Wi-Fi** as the computer.
2. Find the computer's local address. On Windows, run `ipconfig` and look for **IPv4 Address** under your Wi-Fi adapter (for example `192.168.1.76`). On a Mac, use System Settings → Wi-Fi → Details.
3. On the phone, open **http://&lt;that-address&gt;:3000**, for example `http://192.168.1.76:3000`.
4. If the page doesn't load:
   - Check that the server was started with `-H 0.0.0.0`. Plain `npm run dev` only answers on the computer itself.
   - On Windows, allow **Node.js** through the firewall when asked, or allow it under Windows Security → Firewall → Allow an app.
   - If your address doesn't start with `192.168.` or `10.`, add it to `allowedDevOrigins` in `next.config.ts` and restart the server.
   - The address can change when the router restarts, so run `ipconfig` again.

### Sign in
1. Open `/login` and choose the **Password** tab.
2. If you don't have a password yet, set one from the computer:
   ```bash
   node --env-file=.env.local scripts/set-password.mjs you@example.com
   ```
3. On the phone, use the password. Email sign-in links point to `localhost`, which only works on the computer.

### Put it on the phone's home screen
Tap **Install app** in the top bar and follow the steps it shows:
- **iPhone (Safari):** Share → **Add to Home Screen** → Add.
- **Android (Chrome):** ⋮ menu → **Add to Home screen**.

The home-screen icon only opens the app while the computer is running the server and the phone is on the same Wi-Fi. To use it anywhere, deploy the app to a host with an HTTPS address (for example Vercel) and add that address in Supabase → Authentication → URL Configuration.

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
- **Installing on Android:** a full install (its own window, no browser bar) needs the site on HTTPS. Over the local Wi-Fi address (`http://192.168.x.x:3000`), Chrome only offers "Add to Home screen", which creates a shortcut. iPhone's "Add to Home Screen" works either way.
- **Analytics source:** views and watch time come from our own database. ImageKit's built-in player analytics is an Enterprise feature; set `NEXT_PUBLIC_PLAYER_ANALYTICS=true` if your plan includes it.
