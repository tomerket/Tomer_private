# How Screening Room was built

A summary of the tools, the approach and the order things were built in. The detailed plan and every change are in [plan.md](plan.md).

## The idea
"My own private YouTube": a polished viewer site and a creator studio, **without building any video infrastructure**. No ffmpeg, no transcoding, no streaming servers, no CDN setup. ImageKit does all of the media work; the code only covers the product around it.

## Stack

| Layer | Tool | Used for |
|---|---|---|
| Framework | **Next.js 16** (App Router, Cache Components, Server Actions) + **React 19** | Pages, server rendering, caching, mutations |
| Styling | **Tailwind CSS 4** | Design tokens and utilities (`app/globals.css`) |
| Accounts and data | **Supabase** (Postgres, Auth, Row Level Security) | Users, videos, playlists, members, likes, comments, subscriptions, views, analytics |
| Media | **ImageKit** | Storage, uploads, adaptive HLS streaming, thumbnails at any second, signed URLs |
| Player | **ImageKit Video Player** (`@imagekit/video-player`, built on Video.js) | Playback, AI chapters, seek previews, floating mini-player |
| Fonts | Space Grotesk, Inter Tight, Space Mono | Display, interface, timecodes |

## How it was made
The whole app was built in conversation with **Claude Code** (Anthropic's AI coding agent) inside VS Code, steered step by step: decisions, screenshots of reference designs, and test feedback.

**Claude Code used:**
- **MCP connections** to work directly with the services:
  - **Supabase MCP:** created the database, applied migrations, checked security advisories, generated TypeScript types, and ran test queries.
  - **ImageKit MCP** (DAM, Admin, DevTools): searched the current ImageKit docs (the video player was too new to know from training), checked uploads, and confirmed URL formats.
- **Skills** for design quality:
  - **frontend-design:** chose a deliberate visual direction instead of a generic template.
  - **ui-ux-pro-max:** checked UX and accessibility guidance.
  - **dataviz:** set the chart rules and ran a script to validate the chart colour on the dark background.
- The **Next.js 16 docs bundled in the project**, read before writing code, because this version changed several APIs (for example, `middleware.ts` is now `proxy.ts`, and Cache Components has new rules).

## Build order
1. **Plan:** milestones that can each be built and checked on their own (M0–M7), with player details taken from the current ImageKit docs.
2. **Foundation:** the Next.js scaffold, the dark theme and the app shell.
3. **Database and sign-in:** tables, access rules (RLS), creator-only Studio, and email-link sign-in.
4. **Upload:** drag-and-drop straight to ImageKit with progress, cancel and retry.
5. **Studio management:** publish and members-only switches, the thumbnail frame picker, and playlists.
6. **Viewer site:** the cached home feed, video cards and playlist pages.
7. **Watch page:** a custom player wrapper, up next, and playlist auto-advance.
8. **Members-only protection:** a signing endpoint that only signs files the viewer may watch.
9. **Design system:** tokens, the card spec and the `/design` style tile, revised from reference screenshots.
10. **Engagement:** views, likes and dislikes, subscriptions and comments, with counters kept current by the database.
11. **Navigation:** a left sidebar with Subscriptions and History pages.
12. **Creator analytics:** watch-time tracking in the player, charts, and per-video pages.
13. **Demo data and sign-in fixes:** a seed script, password sign-in, and a mobile-friendly dev server.

## Decisions worth knowing
- **A custom wrapper around the ImageKit player.** The bundled React component broke under React's development mode and ignored video changes, so `components/player/Player.tsx` drives the plain JavaScript player API directly.
- **No full-access key in the app.** Access checks run as the signed-in viewer through database functions (`can_stream`, `record_view`, `record_watch`, `creator_*`). The full-access key is only used by local scripts.
- **Counters live in stats tables.** Likes, comments, subscribers, views and watch time are kept in `video_stats` and `channel_stats` by database triggers. Anyone can read the numbers, but not who liked or watched.
- **Views and watch time are our own data.** ImageKit's player analytics is Enterprise-only, so the player reports seconds actually played (capped per report), and analytics are built from that.
- **Scope grew on request.** The first brief excluded comments, likes, subscriptions and view tracking. All of these were added later, at the owner's request.

## Database migrations
| File | Adds |
|---|---|
| `0001_init.sql` | Profiles, members, channels, videos, playlists, access rules, `can_stream` |
| `0003_engagement.sql` | Views, likes and dislikes, subscriptions, comments, stats tables and triggers |
| `0004_history.sql` | Viewers can read their own watch history |
| `0005_creator_analytics.sql` | Daily views and subscribers for the creator |
| `0006_watch_time.sql` | Watch time, `record_watch`, analytics v2 with average percentage watched |

`supabase/pending/0002_advisor_fixes.sql` holds optional database-advisor fixes that were not applied.
