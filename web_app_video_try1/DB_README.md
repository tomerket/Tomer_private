# Database structure

Screening Room stores its data in Supabase (Postgres). There are 12 tables in the `public` schema, and every one has row-level security (RLS) turned on. The schema comes from the migrations in [`supabase/migrations/`](supabase/migrations/), applied in order from `0001` to `0006`.

The videos themselves are not in the database. They live in ImageKit, and each `videos` row only stores the ImageKit file id, path and URL.

> Back to the main [README](README.md). The diagram is also in Supabase under Database → Schema Visualizer.

---

## How the tables connect

```
auth.users (Supabase accounts)
 ├── profiles           1:1     role = creator | viewer
 │    └── channels      1:many  (a creator owns a channel)
 │         ├── channel_stats   1:1   subscriber count
 │         ├── subscriptions   many  (users following the channel)
 │         ├── playlists       many
 │         │    └── playlist_items ──┐  ordered list of videos
 │         └── videos          many ◄┘
 │              ├── video_stats      1:1   views, likes, dislikes, comments, watch time
 │              ├── video_views      many  one row per viewer per video per day
 │              ├── video_reactions  many  like (+1) / dislike (−1), one per user
 │              └── comments         many
 └── members            1:1     who can watch members-only videos
```

Every foreign key uses `ON DELETE CASCADE`. Deleting an account, channel, video or playlist removes everything under it.

---

## Tables

### Accounts
| Table | Primary key | Columns |
|---|---|---|
| `profiles` | `id` → `auth.users` | `display_name`, `avatar_url`, `role` (`creator` or `viewer`, default `viewer`), `created_at` |
| `members` | `user_id` → `auth.users` | `created_at` |

A trigger creates the profile row when someone signs up. To make someone a creator, set `profiles.role = 'creator'`. To make someone a member, insert a row into `members`. Both are done in the Supabase SQL editor; the app has no screen for them.

### Content
| Table | Primary key | Columns |
|---|---|---|
| `channels` | `id` | `owner_id` → `profiles`, `name`, `handle`, `avatar_url`, `created_at` |
| `videos` | `id` | `channel_id` → `channels`, `title`, `description`, `ik_file_id`, `ik_file_path`, `ik_url`, `duration_seconds`, `thumbnail_offset` (second of the frame used as thumbnail), `is_published`, `is_members_only`, `published_at`, `created_at`, `updated_at` |
| `playlists` | `id` | `channel_id` → `channels`, `title`, `description`, `is_published`, `created_at` |
| `playlist_items` | (`playlist_id`, `video_id`) | `position` (order in the playlist) |

### Engagement
| Table | Primary key | Columns |
|---|---|---|
| `video_reactions` | (`video_id`, `user_id`) | `value` (+1 like, −1 dislike), `created_at` |
| `comments` | `id` | `video_id`, `user_id`, `author_name` (filled in by a trigger), `body`, `created_at` |
| `subscriptions` | (`channel_id`, `user_id`) | `created_at` |

### Analytics and counters
| Table | Primary key | Columns |
|---|---|---|
| `video_views` | (`video_id`, `viewer_key`, `day`) | `watched_seconds`, `max_position` |
| `video_stats` | `video_id` | `views`, `likes`, `dislikes`, `comments`, `watch_seconds` |
| `channel_stats` | `channel_id` | `subscribers` |

- `viewer_key` is the user id for signed-in viewers, or an anonymous browser id (the `sr_vk` cookie) for everyone else. Each viewer counts as one view per video per day.
- Triggers keep `video_stats` and `channel_stats` up to date, so pages never count rows.

---

## Who can read and write what (RLS)

| Table | Read | Write |
|---|---|---|
| `videos`, `playlists` | Everyone: published only. Owner: all of their own. | Channel owner |
| `playlist_items` | When the playlist is visible | Channel owner |
| `channels`, `channel_stats` | Everyone | Owner updates their channel; only a creator can create one |
| `video_stats` | Published videos, or the owner's own | Triggers only |
| `comments` | Everyone, on published videos | Signed-in users add their own on published videos. A comment can be deleted by its author or by the channel owner. |
| `video_reactions`, `subscriptions` | Your own rows only (totals are shown from the stats tables) | Your own rows |
| `video_views` | Your own rows only (used for History) | Only through `record_view` / `record_watch` |
| `profiles`, `members` | Your own row only | Not from the app |

The members-only check also covers the video file itself. `/api/sign` signs an ImageKit URL only when `can_stream()` allows it.

---

## Functions

### Called by the app (`public`)
| Function | What it does |
|---|---|
| `can_stream(file_path)` | Returns whether the current viewer may play this file: published, plus member or owner for members-only videos. |
| `record_view(video_id, anon_key)` | Counts a view, at most once per viewer, per video, per day. |
| `record_watch(video_id, anon_key, seconds, position)` | Adds watch time. Each call is capped at 60 seconds, and the position is capped at the video's length. |
| `creator_daily_views_v2(days, video_id)` | Views and watch time per day for the caller's channel, or for one of the caller's videos. |
| `creator_daily_subscribers(days)` | New subscribers per day for the caller's channel. |
| `creator_video_analytics_v2(days)` | Per-video table for Studio analytics: views, average percentage watched, likes and comments. |

The analytics functions only ever return the caller's own channel. `creator_daily_views` and `creator_video_analytics` are older versions that the app no longer calls. They stay in the database because nothing has removed them.

### Internal helpers (`private` schema, not reachable from the browser)
- **Access checks:** `is_creator`, `is_member`, `owns_channel`, `video_is_published`
- **Setup:** `handle_new_user` (creates the profile on sign-up), `create_video_stats`, `create_channel_stats`
- **Counters:** `sync_reaction_stats`, `sync_comment_stats`, `sync_subscription_stats`
- **Upkeep:** `set_comment_author`, `touch_updated_at`

---

## Migrations

| File | Adds |
|---|---|
| `0001_init.sql` | profiles, members, channels, videos, playlists, playlist_items, access helpers, `can_stream`, RLS |
| `0003_engagement.sql` | video_stats, channel_stats, video_views, `record_view`, video_reactions, subscriptions, comments, counter triggers |
| `0004_history.sql` | Lets users read their own `video_views` (History page) |
| `0005_creator_analytics.sql` | First versions of the creator analytics functions |
| `0006_watch_time.sql` | Watch time columns, `record_watch`, and the `_v2` analytics functions |

`0002` was never applied. Its SQL is kept in `supabase/pending/`.
