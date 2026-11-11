# Private Video Platform — Milestone Plan

## Context
A private YouTube-style product with two sides: a public, dark, premium viewer site and a login-gated creator studio. The repo is empty (greenfield). Hard rule: **no video infrastructure of our own**. ImageKit does storage, renditions, ABS streaming, thumbnails and the player UI (chapters, seek previews, mini-player, analytics). Supabase does auth and data. Our code covers only the product around those two services.

Scope is exactly what you listed: no comments, likes, search or subscriptions.

### Environment (updated 2026-11-10)
- **Repo:** scaffolded with `create-next-app` as **Next.js 16.4.6**, React 19.3, Tailwind 4.3 (CSS-first `@theme`, no `tailwind.config`), with `cacheComponents: true` in `next.config.ts`.
  - `AGENTS.md` says this Next version has breaking changes. Read `node_modules/next/dist/docs/` before writing each milestone's code, especially for middleware (it may now be `proxy.ts`), caching under `cacheComponents`, and Server Actions.
  - `npm install` was stopped partway; re-run it first.
- **Supabase:** project **"Web App 1"**, ref `chxnrinfzdhwnmtzukdd`, us-east-1, Postgres 17. Automatic RLS on new tables is enabled. The MCP connection is in `.mcp.json` with read/write access. Scope it with `&project_ref=chxnrinfzdhwnmtzukdd`.
- **ImageKit:** ID / URL endpoint `https://ik.imagekit.io/tomer`, **free plan**. The MCP servers come from `imagekit-plugin@imagekit-tools`:
  - DAM ✅ and DevTools ✅ are connected.
  - Admin ❌ still needs `/mcp` → Authenticate.
- **Docs source:** ImageKit DevTools `search_docs` replaces Context7 for all ImageKit lookups, using the `imagekit-plugin:search-docs` skill.
- **Design skills:** `frontend-design` and `ui-ux-pro-max`, both user scope.

### How the MCP servers are used
- **Supabase MCP:**
  - `apply_migration` applies every migration, and each one also gets saved to `supabase/migrations/`.
  - `generate_typescript_types` writes `lib/supabase/types.ts`.
  - `get_advisors` (security + performance) runs after every schema change.
  - `get_project_url` and `get_publishable_keys` fill `.env.local`.
  - **You** paste the service_role key into `.env.local` yourself, never in chat.
- **ImageKit DAM MCP:** checks uploads during verification (`search_media_library`, `get_file_details`). It is never used inside the app; the app uses the SDKs.
- **ImageKit DevTools MCP:** `search_docs` before any player or upload code; `transformation_builder` checks thumbnail and stream URL syntax.
- **ImageKit Admin MCP:** read-only checks of URL endpoints and usage (VPU) to track free-plan consumption. "Restrict unsigned URLs" (M6) is a dashboard setting **you** flip.

### What the ImageKit docs say (pulled via Context7 `/websites/imagekit_io` plus imagekit.io/docs/video-player, 2026-11-10)
- **Package:** `@imagekit/video-player`. React entry is `@imagekit/video-player/react`, which exports `IKVideoPlayer` and the type `IKVideoPlayerRef`. CSS is `@imagekit/video-player/styles.css`. It's built on Video.js 8.20, **is in beta**, and the docs say to pin the exact version.
- **Props:** `ikOptions` (required; includes `imagekitId`), `source` or `playlist` (`playlist` wins if both are set), and `videoJsOptions`.
- **`ikOptions` gives us these features for free:**
  - `seekThumbnails: true` (default) → hover seek previews
  - `floatingWhenNotVisible: 'right'` → mini-player when you scroll down
  - `signerFn(url) => Promise<string>` → signed URLs for gated media
  - `abs: { protocol: 'hls', sr: [360,480,720,1080] }` → adaptive streaming
  - `analytics: { enabled, userId }` → viewer analytics. **This is an Enterprise feature in beta.** Check that your plan includes it.
  - `maxTries` / `videoTimeoutInMS` → retries while ImageKit is still processing a fresh upload
- **`source` fields:** `src`, `chapters` (`true` = AI-generated, your choice), `info: {title, description}`, `poster: {src}`, `recommendations: SourceOptions[]`.
- **Ref:** `ref.current.getPlayer()` returns the Video.js player, which can be null right after mount, so poll for it. It exposes `.on('ended')`, `.currentTime()` and `.play()`.
- **ABS restriction:** with ABS on, `w`, `h`, `ar`, `f`, `vc`, `ac` and `q` transforms are disallowed on the video.
- **Thumbnails:** `<videoUrl>/ik-thumbnail.jpg?tr=so-<seconds>,w-640`. `so` is the frame offset; this is how "pick a thumbnail frame" works.
- **Upload (`@imagekit/next`):**
  - Server: `getUploadAuthParams({publicKey, privateKey})` from `@imagekit/next/server` returns `{token, signature, expire}`.
  - Client: `upload({file, fileName, token, expire, signature, publicKey, onProgress, abortSignal})` returns `{fileId, url, filePath, duration, ...}`.
  - Each upload needs a fresh token.
- **Signing:** the Node SDK `@imagekit/nodejs` provides `client.helper.buildSrc({ src, signed: true, expiresIn })`. This must run on the server.

## Architecture decisions
- **Next.js App Router + Tailwind**, TypeScript, deployed as a single app.
  - Route groups: `app/(viewer)/…` and `app/studio/…`.
  - The player lives in one client component, `components/player/Player.tsx`, marked `'use client'` and loaded with `next/dynamic({ ssr:false })` because Video.js touches `window`.
- **Supabase:** `@supabase/ssr` for cookie sessions, plus `middleware.ts` to protect `/studio/**`. Login uses magic link (email OTP), with one login page for both creator and members.
- **Roles:**
  - `profiles.role` is `'creator' | 'viewer'`.
  - A `members` table holds the user ids that are members.
  - You add members by SQL insert in the Supabase dashboard. Your scope has no members-management UI, so the plan doesn't add one.
- **Members-only gating that actually protects the file:**
  - Turn on ImageKit "restrict unsigned URLs" for video.
  - Every player source goes through `signerFn` → `POST /api/sign`.
  - That route resolves the URL's `file_path` to a `videos` row and checks published plus members-only status against the Supabase session. It signs only if the viewer is allowed, and returns 403 otherwise.
  - The DB flag is enforced both in RLS and at the media layer.
- **Feed visibility:** members-only videos show in the grid with a lock badge. On the watch page, non-members get a "Members only — sign in" gate instead of the player.
- **Chapters:** `chapters: true` (AI) on every source. This needs no studio UI.
- **Duration:** taken from the upload response `duration` and stored in the DB. No probing.
- **Up next:**
  - With `?list=<playlistId>`, the sidebar shows that playlist's order, and `ended` auto-advances via `router.push`.
  - Without a list, it shows other recent published videos.
  - The same list is passed as `recommendations` for the player's end screen.

## Data model (Supabase, `supabase/migrations/0001_init.sql`)
- `profiles(id uuid pk → auth.users, display_name, avatar_url, role text default 'viewer')`
- `members(user_id uuid pk → auth.users, created_at)`
- `channels(id, owner_id → profiles, name, handle, avatar_url)`: one row per creator, used for "channel info" on cards
- `videos(id uuid, channel_id, title, description, ik_file_id, ik_file_path, ik_url, duration_seconds numeric, thumbnail_offset numeric default 0, is_published bool default false, is_members_only bool default false, published_at, created_at, updated_at)`
- `playlists(id, channel_id, title, description, is_published bool, created_at)`
- `playlist_items(playlist_id, video_id, position int, pk(playlist_id, video_id))`
- **RLS:**
  - Anon and authenticated users can `select` videos and playlists where `is_published`. Members-only metadata stays visible, and the stream is gated by `/api/sign`.
  - The creator (`role='creator'` and owns the channel) has full CRUD.
  - `members` is readable only by its own row. A SQL helper `is_member()` returns a boolean.
- Generated types go in `lib/supabase/types.ts` via `supabase gen types`.

## Key files
- `lib/imagekit.ts`: URL builders `streamSrc(path)`, `thumbUrl(path, offset, w)` and `posterUrl()`, all pure string functions.
- `lib/imagekit.server.ts`: the Node SDK client, `signUrl()` and `uploadAuth()`. Server-only.
- `lib/supabase/{server,client,middleware}.ts`
- `app/api/imagekit/auth/route.ts`: creator-only upload auth params
- `app/api/sign/route.ts`: access check and signed URL, returned as plain text
- `components/player/Player.tsx`: `IKVideoPlayer` with our `ikOptions` and source mapping
- `components/VideoCard.tsx`, `components/VideoGrid.tsx`, `components/UpNext.tsx`
- `app/(viewer)/page.tsx`, `app/(viewer)/watch/[id]/page.tsx`, `app/(viewer)/playlists/page.tsx`, `app/(viewer)/playlist/[id]/page.tsx`, `app/login/page.tsx`
- `app/studio/page.tsx` (video table), `app/studio/upload/page.tsx`, `app/studio/videos/[id]/page.tsx`, `app/studio/playlists/…`
- `app/studio/actions.ts`: Server Actions for update, publish toggle, members toggle and playlist CRUD

---

## Milestones
Each milestone ends in something you can click and verify.

### Scope change (2026-11-10, owner request)
The watch page now has **views, likes/dislikes, subscriptions and comments**. These reverse the original exclusions. Any signed-in viewer can like, subscribe and comment; the creator can delete any comment.
- **Schema:** `supabase/migrations/0003_engagement.sql`.
  - Counters live in `video_stats` / `channel_stats`, kept current by triggers.
  - Views are deduplicated per viewer per video per day through `record_view()`. Signed-out viewers are identified by an anonymous cookie.
- **Code:** `app/watch/actions.ts`, `lib/engagement.ts`, `app/watch/[id]/Engagement.tsx`. Card meta shows "241K views · 3 days ago".
- **Recommended next step:** connect a custom SMTP sender in Supabase so viewer sign-ins aren't limited to about 2 emails an hour.

### Build status (2026-11-10)
M0–M7 are implemented. Type check, lint and `next build` pass. Smoke tests pass: route guards, `/api/sign` refusing unknown files and foreign hosts, upload auth refusing anonymous callers, and ImageKit serving `so-` frame thumbnails and HLS manifests.

End-to-end checks still need you to sign in. The remaining steps:
1. **Supabase dashboard → Authentication → URL Configuration:** set the Site URL to `http://localhost:3000` and add `http://localhost:3000/**` to Redirect URLs.
2. Sign in at `/login`, then make your account a creator: `update profiles set role='creator' where id=(select id from auth.users where email='<you>')`.
3. Name your channel in `/studio`, upload a clip, publish it, and watch it.
4. **M6 media-level gating:** in the ImageKit dashboard, Settings → Videos → Restrict unsigned URLs → "Restrict all requests". Then set `NEXT_PUBLIC_IMAGEKIT_SIGNED_DELIVERY=true` in `.env.local` and restart. If image thumbnails also need it, apply the same setting under Settings → Images.
5. **Members:** `insert into members (user_id) select id from auth.users where email='<member>'`.

#### Changes from the plan while building
- **No service-role key.** `/api/sign` calls the `public.can_stream(file_path)` SQL function as the viewer. Access helpers live in a non-exposed `private` schema.
- **Custom player wrapper.** `components/player/Player.tsx` uses the vanilla `videoPlayer()` export, not the bundled `IKVideoPlayer`. The wrapper ignores source changes and reuses a disposed `<video>` element, which breaks under React Strict Mode. Its React peer is 17–18, so npm `overrides` pin it to our React 19.
- **Plain `<img>` with ImageKit srcsets, no `next/image`.** Re-processing would break signed thumbnail URLs.
- **No player `recommendations` end screen.** It would switch videos inside the player without changing the URL. Playlists auto-advance on `ended` instead.
- **Supabase advisor fixes (`supabase/pending/0002_advisor_fixes.sql`) were declined** and are not applied. They are optional: revoking `rls_auto_enable` from the API, and splitting one RLS policy for performance.
- **Unknown IDs render the not-found page with HTTP 200.** The 404 happens after streaming starts, so this is a Cache Components trade-off.

### M0 — Foundation ✅ done 2026-11-10
Product name: **Screening Room**. Design direction: "screening room", meaning slate-plum surfaces, bone text, a tungsten-amber accent used only for state, and Bricolage Grotesque + IBM Plex Sans. Decisions are recorded in `design-system/screening-room/MASTER.md`. Route protection in M1 uses `proxy.ts`; the Next 16 docs confirm the rename.

- Scaffold: done (Next 16.4 + Tailwind 4). Re-run `npm install`.
- **Design direction pass:**
  - Use the `frontend-design` skill to plan, self-review and revise.
  - Use `ui-ux-pro-max` for a `--design-system --stack nextjs` query, persisted to `design-system/<slug>/MASTER.md`.
  - Dark is fixed by your brief. Palette, type and accent are chosen for this brief, not the generic "near-black + one bright accent" default that the skill flags.
  - Tokens are defined in `app/globals.css` under `@theme`.
- **App shell:** top bar, logo, and Studio / Sign-in links.
- **`.env.example`:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/tomer`, `NEXT_PUBLIC_IMAGEKIT_ID=tomer`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`.
- **`.env.local`:** the Supabase URL and key come from the MCP. You fill in the private and service keys.
- **Verify:**
  - `npm run dev` renders the dark shell.
  - `npm run build` passes.
  - `design-system/…/MASTER.md` exists.

### M1 — Supabase schema + auth
- Write the migration above, including RLS.
  - Apply it with Supabase MCP `apply_migration` and save the same SQL in `supabase/migrations/0001_init.sql`.
  - Run `get_advisors` and fix any security warnings.
- Generate types with `generate_typescript_types`.
- Wire up `@supabase/ssr` and the magic-link login page.
  - In the Supabase dashboard, set the Auth Site URL to `http://localhost:3000`.
- Route protection uses `middleware.ts`, or `proxy.ts` if the Next 16 docs say it was renamed. It redirects non-creators away from `/studio`.
- Seed your creator profile and channel via `execute_sql` after your first login.
- **Verify:**
  - Sign in by magic link.
  - Promote yourself with `update profiles set role='creator'` → `/studio` loads.
  - A second account gets redirected.
  - Anon `select` on an unpublished video returns 0 rows (Supabase SQL editor using the anon role).

### M2 — Studio upload
- Build `/api/imagekit/auth`, which checks the creator session first.
- Drag-and-drop zone with a multi-file queue: `upload()` per file, a progress bar from `onProgress`, cancel via `AbortController`, and error states mapped from the `ImageKit*Error` classes.
- On success, a Server Action inserts the `videos` row with fileId, filePath, url and duration, unpublished, using the filename as the title.
- **Verify:**
  - Drop 2 videos and watch both bars advance.
  - Cancel one mid-upload.
  - The file appears in the ImageKit Media Library (checked with DAM MCP `search_media_library`) and the row appears in Supabase (checked with `execute_sql`) with `duration_seconds` filled.
  - Before real content exists, the account's `sample-video.mp4` (6s) can be used for player testing.

### M3 — Studio manage
- `/studio` is a table of all your videos (thumb, title, duration, status pills, updated). Each row has one-click **Publish/Unpublish** and **Members-only** toggles: Server Actions with optimistic UI that set `published_at`.
- `/studio/videos/[id]` edits title and description.
- **Thumbnail frame picker:**
  - A strip of ~8 candidate frames at evenly spaced offsets, using `thumbUrl(path, offset)`.
  - A scrubber slider for an exact second with a live preview.
  - Saves `thumbnail_offset`.
- **Playlists:** create, rename and delete, add or remove videos, and reorder with drag or up/down buttons that write `position`.
- **Verify:** toggle publish and the row flips in the DB. Pick frame 37s, and the card thumbnail URL contains `so-37`. Reorder a playlist and the positions persist on reload.

### M4 — Viewer home feed + playlists
- `/` is a server-rendered dense responsive grid (2 → 6 columns) of published videos.
- **`VideoCard`:**
  - 16:9 `ik-thumbnail` image with the chosen offset and width via `next/image` (`remotePatterns` set to the ImageKit domain)
  - duration chip formatted as `m:ss` or `h:mm:ss`
  - lock badge for members-only
  - title clamped to 2 lines
  - channel avatar and name
  - relative published date
  - skeleton loading state
- `/playlists` is a grid of playlists. `/playlist/[id]` shows the ordered list with "Play all" → `/watch/<first>?list=<id>`.
- **Verify:** only published videos appear, and unpublishing in the studio removes a video after refresh. The layout holds at 375px and 1920px.

### M5 — Watch page + player (no gating yet)
- **`Player.tsx`:**
  - `ikOptions` = `{ imagekitId, seekThumbnails: true, floatingWhenNotVisible: 'right', abs: {protocol:'hls', sr:[360,480,720,1080]}, analytics: { enabled: true, userId } }`
  - `source` = `{ src: ik_url, chapters: true, info: {title, description}, poster: {src: thumbUrl(...)}, recommendations }`
  - `videoJsOptions` = `{ fluid: true, controls: true, playbackRates: [...] }`
- Pin the package version and import its CSS.
- Restyle the player with CSS overrides on the `.video-js` classes so it matches our tokens.
- **Watch layout:**
  - player
  - title
  - channel row
  - expandable description
  - `UpNext` sidebar on the right; it moves below the player on mobile
- `?list=` mode shows a playlist panel with the current item highlighted. A ref polls `getPlayer()` and attaches `ended` → navigate to the next item.
- **Verify:**
  - It plays as HLS: the Network tab shows `ik-master.m3u8` and rendition switching.
  - The chapter markers and menu appear.
  - Hovering the seek bar shows frame previews.
  - Scrolling down produces the floating mini-player on the right.
  - Ending a playlist item auto-advances.
  - Events appear in the ImageKit analytics dashboard, if your plan includes analytics.

### M6 — Members-only gating
- Enable "restrict unsigned URLs" for video in the ImageKit dashboard.
- **`/api/sign`:**
  - Parse the incoming URL to `file_path`.
  - Look up the video with the service-role client.
  - Allow it if the video is published and either not members-only, or the session user is in `members` (the creator is always allowed, for studio previews).
  - Sign with `buildSrc({signed:true, expiresIn: 3600})` and return text, or 403.
- Pass `signerFn` in `Player`.
- The watch page server-renders the gate UI for non-members, so the player never mounts for them.
- Studio previews use the same signer.
- **Thumbnails:** check whether the restriction covers `ik-thumbnail.jpg` too. If it does, sign thumbnail URLs server-side in `VideoCard` and the picker, with a long expiry rounded to a whole hour so they stay cacheable.
- **Verify:**
  - A logged-out user on a members-only video sees the gate.
  - Pasting the raw `ik-master.m3u8` URL returns 403 from ImageKit.
  - A member account plays it.
  - A non-member calling `curl -X POST /api/sign` with that URL gets 403.
  - Public videos still play for anonymous users.

### M7 — Premium polish pass
Polish only, no new features:
- hover lift and focus rings on cards
- 300ms thumbnail fade-in
- page-transition skeletons (`loading.tsx` per route)
- empty states (no videos, empty playlist)
- `not-found.tsx` for unpublished or missing IDs
- `<title>` and Open Graph tags per video, using the thumbnail as the OG image
- keyboard accessibility on toggles and drag-drop
- Lighthouse pass

**Verify:** Lighthouse is ≥90 for performance and accessibility on home and watch, with no layout shift on grid load.

---

## Explicitly not built
ffmpeg, transcoding, HLS servers, CDN config, custom analytics events, comments, likes, search, subscriptions, a members-management UI and a chapter editor.

## Risks to watch
- **The player is in beta.** Pin the version and keep all player code in `Player.tsx` so API changes touch one file.
- **Player analytics is Enterprise and in beta.** You're on the free plan, so `analytics` ships behind `NEXT_PUBLIC_PLAYER_ANALYTICS=false`. Flip it if you upgrade; nothing else changes.
- **AI chapters cost extension units** per video minute, and they generate on first request, so a fresh video may show chapters only after processing. ABS renditions also use free-plan video units. Watch usage via Admin MCP `get_vpu_daily_usage` and test with short clips.
- **Just-uploaded videos can 404 briefly while processing.** Rely on the player's `maxTries` / `videoTimeoutInMS` rather than building any polling.
